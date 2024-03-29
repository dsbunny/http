"use strict";
// vim: tabstop=8 softtabstop=0 noexpandtab shiftwidth=8 nosmarttab
Object.defineProperty(exports, "__esModule", { value: true });
exports.conditionalRequestGuards = void 0;
// Apply conditional request guards to a response.
// Returns 200 if the request is valid.
// Returns 304 if the guards match the request.
// Returns 412 if the guards do not match the request.
function conditionalRequestGuards(req, origin_etag, origin_modify_timestamp) {
    // REF: https://datatracker.ietf.org/doc/html/rfc7232#section-6
    // Step 1.  When recipient is the origin server and If-Match is present,
    // evaluate the If-Match precondition
    const if_match = req.get('If-Match');
    if (if_match
        && !ifMatchPrecondition(if_match, origin_etag)) {
        // Condition is false, and requested method MUST NOT be performed.
        return {
            status: 412, // Or 2xx (Successful)
            statusText: `Precondition failed: If-Match: ${if_match} does not match ETag: ${origin_etag}`,
        };
    }
    // Step 2.  When recipient is the origin server, If-Match is not
    // present, and If-Unmodified-Since is present, evaluate the
    // If-Unmodified-Since precondition.
    if (!if_match) {
        const if_unmodified_since = req.get('If-Unmodified-Since');
        if (if_unmodified_since
            && !ifUnmodifiedSincePrecondition(if_unmodified_since, origin_modify_timestamp)) {
            // Condition is false, and requested method MUST NOT be performed.
            return {
                status: 412, // Or 2xx (Successful)
                statusText: `Precondition failed: If-Unmodified-Since: ${if_unmodified_since} is after Last-Modified: ${new Date(origin_modify_timestamp).toUTCString()}`,
            };
        }
    }
    // Step 3.  When If-None-Match is present, evaluate the If-None-Match
    // precondition
    const if_none_match = req.get('If-None-Match');
    if (if_none_match
        && !ifNoneMatchPrecondition(if_none_match, origin_etag)) {
        return (req.method === 'GET' || req.method === 'HEAD')
            ? {
                status: 304,
                statusText: 'Not Modified',
            }
            : {
                status: 412,
                statusText: `Precondition failed: If-None-Match: ${if_none_match} matches ETag: ${origin_etag}`,
            };
    }
    // Step 4. When the method is GET or HEAD, If-None-Match is not present,
    // and If-Modified-Since is present, evaluate the If-Modified-Since
    // precondition
    if (req.method === 'GET'
        && !if_none_match) {
        const if_modified_since = req.get('If-Modified-Since');
        if (if_modified_since
            && !ifModifiedSincePrecondition(if_modified_since, origin_modify_timestamp)) {
            return {
                status: 304,
                statusText: 'Not Modified',
            };
        }
    }
    return {
        status: 200,
        statusText: 'OK',
    };
}
exports.conditionalRequestGuards = conditionalRequestGuards;
// REF: https://datatracker.ietf.org/doc/html/rfc7232#section-2.3.2
// +--------+--------+-------------------+-----------------+
// | ETag 1 | ETag 2 | Strong Comparison | Weak Comparison |
// +--------+--------+-------------------+-----------------+
// | W/"1"  | W/"1"  | no match          | match           |
// | W/"1"  | W/"2"  | no match          | no match        |
// | W/"1"  | "1"    | no match          | match           |
// | "1"    | "1"    | match             | match           |
// +--------+--------+-------------------+-----------------+
function strongComparision(a, b) {
    return isStrongEntityTag(a) && isStrongEntityTag(b) && a === b;
}
function weakComparision(a, b) {
    return a === b || opaqueTag(a) === opaqueTag(b);
}
function isWeakEntityTag(etag) {
    return etag.startsWith('W/');
}
function isStrongEntityTag(etag) {
    return !isWeakEntityTag(etag);
}
// Strip weak identifier from entity tag.
function opaqueTag(etag) {
    return etag.replace(/^W\//, '');
}
// If-Match is most often used with state-changing methods (e.g., POST,
// PUT, DELETE) to prevent accidental overwrites when multiple user
// agents might be acting in parallel on the same resource (i.e., to
// prevent the "lost update" problem).  It can also be used with safe
// methods to abort a request if the selected representation does not
// match one already stored (or partially stored) from a prior request.
//
//   If-Match = "*" / 1#entity-tag
// Examples:
//   If-Match: "xyzzy"
//   If-Match: "xyzzy", "r2d2xxxx", "c3piozzzz"
//   If-Match: *
function ifMatchPrecondition(if_match, origin_etag) {
    if (if_match === '*') {
        // Condition is true as origin server does have a representation.
        return true;
    }
    const etags = if_match.split(',').map((s) => s.trim());
    if (etags.some((etag) => strongComparision(etag, origin_etag))) {
        // Condition is true upon strong match.
        return true;
    }
    // Condition is false, and requested method MUST NOT be performed.
    return false;
}
// If-None-Match is primarily used in conditional GET requests to enable
// efficient updates of cached information with a minimum amount of
// transaction overhead.  When a client desires to update one or more
// stored responses that have entity-tags, the client SHOULD generate an
// If-None-Match header field containing a list of those entity-tags
// when making a GET request; this allows recipient servers to send a
// 304 (Not Modified) response to indicate when one of those stored
// responses matches the selected representation.
//
// If-None-Match can also be used with a value of "*" to prevent an
// unsafe request method (e.g., PUT) from inadvertently modifying an
// existing representation of the target resource when the client
// believes that the resource does not have a current representation
// (Section 4.2.1 of [RFC7231]).  This is a variation on the "lost
// update" problem that might arise if more than one client attempts to
// create an initial representation for the target resource.
//
//   If-None-Match = "*" / 1#entity-tag
// Examples:
//   If-None-Match: "xyzzy"
//   If-None-Match: W/"xyzzy"
//   If-None-Match: "xyzzy", "r2d2xxxx", "c3piozzzz"
//   If-None-Match: W/"xyzzy", W/"r2d2xxxx", W/"c3piozzzz"
//   If-None-Match: *
function ifNoneMatchPrecondition(if_none_match, origin_etag) {
    if (if_none_match === '*') {
        // Condition is false as origin server does have a representation.
        return false;
    }
    const etags = if_none_match.split(',').map((s) => s.trim());
    if (etags.some((etag) => weakComparision(etag, origin_etag))) {
        // Condition is false upon weak match.
        return false;
    }
    // Condition is true, perform the requested method.
    return true;
}
// A recipient MUST ignore If-Modified-Since if the request contains an
// If-None-Match header field; the condition in If-None-Match is
// considered to be a more accurate replacement for the condition in
// If-Modified-Since, and the two are only combined for the sake of
// interoperating with older intermediaries that might not implement
// If-None-Match.
function ifModifiedSincePrecondition(if_modified_since, origin_modify_timestamp) {
    return Date.parse(if_modified_since) <= origin_modify_timestamp;
}
//  If-Unmodified-Since is most often used with state-changing methods
// (e.g., POST, PUT, DELETE) to prevent accidental overwrites when
// multiple user agents might be acting in parallel on a resource that
// does not supply entity-tags with its representations (i.e., to
// prevent the "lost update" problem).  It can also be used with safe
// methods to abort a request if the selected representation does not
// match one already stored (or partially stored) from a prior request.
function ifUnmodifiedSincePrecondition(if_unmodified_since, origin_modify_timestamp) {
    return Date.parse(if_unmodified_since) > origin_modify_timestamp;
}
//# sourceMappingURL=conditional-request-guards.js.map