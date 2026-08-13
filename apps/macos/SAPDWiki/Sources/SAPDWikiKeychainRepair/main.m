#import <Foundation/Foundation.h>
#import <Security/Security.h>

static NSString *const SAPDService = @"com.sapd-wiki.local-mcp.web-dev";
static NSString *const SecurityToolPath = @"/usr/bin/security";

typedef NS_ENUM(int, SAPDExitCode) {
    SAPDExitSuccess = 0,
    SAPDExitInvalidRequest = 2,
    SAPDExitItemMissing = 10,
    SAPDExitInteractionUnavailable = 11,
    SAPDExitAccessDenied = 12,
    SAPDExitUserCancelled = 13,
    SAPDExitBackendFailure = 14,
};

static BOOL validAccount(NSString *account) {
    static NSRegularExpression *expression;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        expression = [NSRegularExpression regularExpressionWithPattern:
            @"^sapd-wiki-mcp:[0-9a-f]{64}:[a-z][a-z0-9-]{1,31}:[A-Za-z0-9_-]{16,96}:server-key$"
            options:0
            error:NULL];
    });
    NSRange full = NSMakeRange(0, account.length);
    NSTextCheckingResult *match = [expression firstMatchInString:account options:0 range:full];
    return match && NSEqualRanges(match.range, full);
}

static void printJSON(NSDictionary<NSString *, id> *payload) {
    NSData *data = [NSJSONSerialization dataWithJSONObject:payload options:0 error:NULL];
    fwrite(data.bytes, 1, data.length, stdout);
    fputc('\n', stdout);
}

static SAPDExitCode classifyStatus(OSStatus status) {
    if (status == errSecItemNotFound) return SAPDExitItemMissing;
    if (status == errSecInteractionNotAllowed) return SAPDExitInteractionUnavailable;
    if (status == errSecAuthFailed || status == errSecNoAccessForItem) return SAPDExitAccessDenied;
    if (status == errSecUserCanceled) return SAPDExitUserCancelled;
    return SAPDExitBackendFailure;
}

static int fail(OSStatus status) {
    SAPDExitCode code = classifyStatus(status);
    printJSON(@{
        @"ok": @NO,
        @"code": @{
            @(SAPDExitItemMissing): @"ITEM_MISSING",
            @(SAPDExitInteractionUnavailable): @"INTERACTION_UNAVAILABLE",
            @(SAPDExitAccessDenied): @"ACCESS_DENIED",
            @(SAPDExitUserCancelled): @"USER_CANCELLED",
            @(SAPDExitBackendFailure): @"BACKEND_FAILURE",
        }[@(code)] ?: @"BACKEND_FAILURE"
    });
    return code;
}

static OSStatus findItem(
    SecKeychainRef keychain,
    NSString *service,
    NSString *account,
    SecKeychainItemRef *item
) {
    // Both password output parameters are deliberately NULL. This locates the
    // exact generic-password item without reading or copying its secret data.
    return SecKeychainFindGenericPassword(
        keychain,
        (UInt32)[service lengthOfBytesUsingEncoding:NSUTF8StringEncoding],
        service.UTF8String,
        (UInt32)[account lengthOfBytesUsingEncoding:NSUTF8StringEncoding],
        account.UTF8String,
        NULL,
        NULL,
        item
    );
}

static BOOL trustedApplicationsContainSecurity(CFArrayRef applications) {
    if (!applications) {
        return YES;
    }
    SecTrustedApplicationRef expected = NULL;
    if (SecTrustedApplicationCreateFromPath(SecurityToolPath.fileSystemRepresentation, &expected) != errSecSuccess) {
        return NO;
    }
    CFDataRef expectedData = NULL;
    BOOL found = NO;
    if (SecTrustedApplicationCopyData(expected, &expectedData) == errSecSuccess) {
        for (CFIndex index = 0; index < CFArrayGetCount(applications); index++) {
            SecTrustedApplicationRef candidate = (SecTrustedApplicationRef)CFArrayGetValueAtIndex(applications, index);
            CFDataRef candidateData = NULL;
            if (SecTrustedApplicationCopyData(candidate, &candidateData) == errSecSuccess) {
                found = CFEqual(expectedData, candidateData);
                CFRelease(candidateData);
            }
            if (found) break;
        }
        CFRelease(expectedData);
    }
    CFRelease(expected);
    return found;
}

static OSStatus copyAccessState(
    SecKeychainItemRef item,
    SecAccessRef *access,
    CFArrayRef *aclList,
    BOOL *securityTrusted
) {
    OSStatus status = SecKeychainItemCopyAccess(item, access);
    if (status != errSecSuccess) return status;
    status = SecAccessCopyACLList(*access, aclList);
    if (status != errSecSuccess) return status;

    BOOL sawDecryptACL = NO;
    BOOL trusted = NO;
    for (CFIndex index = 0; index < CFArrayGetCount(*aclList); index++) {
        SecACLRef acl = (SecACLRef)CFArrayGetValueAtIndex(*aclList, index);
        CFArrayRef authorizations = SecACLCopyAuthorizations(acl);
        BOOL decrypts = authorizations && CFArrayContainsValue(
            authorizations,
            CFRangeMake(0, CFArrayGetCount(authorizations)),
            kSecACLAuthorizationDecrypt
        );
        if (authorizations) CFRelease(authorizations);
        if (!decrypts) continue;
        sawDecryptACL = YES;

        CFArrayRef applications = NULL;
        CFStringRef description = NULL;
        SecKeychainPromptSelector promptSelector = 0;
        status = SecACLCopyContents(acl, &applications, &description, &promptSelector);
        if (status != errSecSuccess) return status;
        trusted = trusted || trustedApplicationsContainSecurity(applications);
        if (applications) CFRelease(applications);
        if (description) CFRelease(description);
    }
    if (!sawDecryptACL) return errSecNoAccessForItem;
    *securityTrusted = trusted;
    return errSecSuccess;
}

static int diagnose(SecKeychainRef keychain, NSString *service, NSString *account) {
    SecKeychainStatus keychainStatus = 0;
    OSStatus status = SecKeychainGetStatus(keychain, &keychainStatus);
    if (status != errSecSuccess) return fail(status);

    SecKeychainItemRef item = NULL;
    status = findItem(keychain, service, account, &item);
    if (status == errSecItemNotFound) {
        printJSON(@{
            @"ok": @YES,
            @"keychain_unlocked": (keychainStatus & kSecUnlockStateStatus) != 0 ? @YES : @NO,
            @"item_found": @NO,
            @"security_trusted": @NO,
            @"secret_api_calls": @0,
        });
        return SAPDExitSuccess;
    }
    if (status != errSecSuccess) return fail(status);

    SecAccessRef access = NULL;
    CFArrayRef aclList = NULL;
    BOOL securityTrusted = NO;
    status = copyAccessState(item, &access, &aclList, &securityTrusted);
    if (aclList) CFRelease(aclList);
    if (access) CFRelease(access);
    CFRelease(item);
    if (status != errSecSuccess) return fail(status);

    printJSON(@{
        @"ok": @YES,
        @"keychain_unlocked": (keychainStatus & kSecUnlockStateStatus) != 0 ? @YES : @NO,
        @"item_found": @YES,
        @"security_trusted": @(securityTrusted),
        @"secret_api_calls": @0,
    });
    return SAPDExitSuccess;
}

static int repair(SecKeychainRef keychain, NSString *service, NSString *account) {
    SecKeychainItemRef item = NULL;
    OSStatus status = findItem(keychain, service, account, &item);
    if (status != errSecSuccess) return fail(status);

    SecAccessRef access = NULL;
    CFArrayRef aclList = NULL;
    BOOL securityAlreadyTrusted = NO;
    status = copyAccessState(item, &access, &aclList, &securityAlreadyTrusted);
    if (status != errSecSuccess) {
        if (aclList) CFRelease(aclList);
        if (access) CFRelease(access);
        CFRelease(item);
        return fail(status);
    }
    if (securityAlreadyTrusted) {
        CFRelease(aclList);
        CFRelease(access);
        CFRelease(item);
        printJSON(@{
            @"ok": @YES,
            @"changed": @NO,
            @"updated_decrypt_acl_count": @0,
            @"secret_api_calls": @0,
        });
        return SAPDExitSuccess;
    }

    SecTrustedApplicationRef securityTool = NULL;
    status = SecTrustedApplicationCreateFromPath(SecurityToolPath.fileSystemRepresentation, &securityTool);
    if (status != errSecSuccess) {
        CFRelease(aclList);
        CFRelease(access);
        CFRelease(item);
        return fail(status);
    }
    CFIndex updated = 0;
    for (CFIndex index = 0; index < CFArrayGetCount(aclList); index++) {
        SecACLRef acl = (SecACLRef)CFArrayGetValueAtIndex(aclList, index);
        CFArrayRef authorizations = SecACLCopyAuthorizations(acl);
        BOOL decrypts = authorizations && CFArrayContainsValue(
            authorizations,
            CFRangeMake(0, CFArrayGetCount(authorizations)),
            kSecACLAuthorizationDecrypt
        );
        if (authorizations) CFRelease(authorizations);
        if (!decrypts) continue;

        CFArrayRef existingApplications = NULL;
        CFStringRef description = NULL;
        SecKeychainPromptSelector promptSelector = 0;
        status = SecACLCopyContents(acl, &existingApplications, &description, &promptSelector);
        if (status == errSecSuccess) {
            CFMutableArrayRef updatedApplications = existingApplications
                ? CFArrayCreateMutableCopy(
                    kCFAllocatorDefault,
                    0,
                    existingApplications
                )
                : CFArrayCreateMutable(
                    kCFAllocatorDefault,
                    0,
                    &kCFTypeArrayCallBacks
                );
            CFArrayAppendValue(updatedApplications, securityTool);
            status = SecACLSetContents(
                acl,
                updatedApplications,
                description,
                promptSelector
            );
            CFRelease(updatedApplications);
        }
        if (existingApplications) CFRelease(existingApplications);
        if (description) CFRelease(description);
        if (status != errSecSuccess) break;
        updated++;
    }
    if (status == errSecSuccess && updated == 0) status = errSecNoAccessForItem;
    if (status == errSecSuccess) status = SecKeychainItemSetAccess(item, access);

    CFRelease(securityTool);
    CFRelease(aclList);
    CFRelease(access);
    CFRelease(item);
    if (status != errSecSuccess) return fail(status);

    printJSON(@{
        @"ok": @YES,
        @"changed": @YES,
        @"updated_decrypt_acl_count": @(updated),
        @"secret_api_calls": @0,
    });
    return SAPDExitSuccess;
}

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        if (argc != 5) {
            printJSON(@{@"ok": @NO, @"code": @"INVALID_REQUEST"});
            return SAPDExitInvalidRequest;
        }
        NSString *command = [NSString stringWithUTF8String:argv[1]];
        NSString *keychainPath = [NSString stringWithUTF8String:argv[2]];
        NSString *service = [NSString stringWithUTF8String:argv[3]];
        NSString *account = [NSString stringWithUTF8String:argv[4]];
        if (![service isEqualToString:SAPDService] || !validAccount(account)) {
            printJSON(@{@"ok": @NO, @"code": @"INVALID_REQUEST"});
            return SAPDExitInvalidRequest;
        }

        SecKeychainRef keychain = NULL;
        OSStatus status = SecKeychainOpen(keychainPath.fileSystemRepresentation, &keychain);
        if (status != errSecSuccess) return fail(status);

        int result;
        if ([command isEqualToString:@"diagnose"]) {
            result = diagnose(keychain, service, account);
        } else if ([command isEqualToString:@"repair"]) {
            result = repair(keychain, service, account);
        } else {
            printJSON(@{@"ok": @NO, @"code": @"INVALID_REQUEST"});
            result = SAPDExitInvalidRequest;
        }
        CFRelease(keychain);
        return result;
    }
}
