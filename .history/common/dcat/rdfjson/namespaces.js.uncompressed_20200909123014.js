/*global define*/
define("rdfjson/namespaces", ["exports"], function (exports) {
    var nss = {
        ical: "http://www.w3.org/2002/12/cal/ical#",
        vcard: "http://www.w3.org/2006/vcard/ns#",
        dcterms: "http://purl.org/dc/terms/",
        skos: "http://www.w3.org/2004/02/skos/core#",
        rdfs: "http://www.w3.org/2000/01/rdf-schema#",
        rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
        owl: "http://www.w3.org/2002/07/owl#",
        vs: "http://www.w3.org/2003/06/sw-vocab-status/ns#",
        foaf: "http://xmlns.com/foaf/0.1/",
        wot: "http://xmlns.com/wot/0.1/",
        dc: "http://purl.org/dc/elements/1.1/",
        xsd: "http://www.w3.org/2001/XMLSchema#"
    };
    var nscounter = 0;
    var _nsify = function(ns, expanded, localname) {
        if (!nss[ns]) {
            nss[ns] = expanded;
        }
        return {
            abbrev: ns,
            ns: expanded,
            localname: localname,
            full: expanded+localname,
            pretty: ns+":"+localname
        };
    }

    exports.nsify = function(uri) {
        for (var ns in nss) {
            if (uri.indexOf(nss[ns]) === 0) {
                return _nsify(ns, nss[ns], uri.substring(nss[ns].length));
            }
        }
        var slash = uri.lastIndexOf("/");
        var hash = uri.lastIndexOf("#");
        if (hash> slash) {
            slash = hash;
        }
        nscounter++;
        return _nsify("ns"+nscounter, uri.substring(0,slash+1),uri.substring(slash+1));
    };

    exports.shorten = function(uri) {
        return exports.nsify(uri).pretty;
    };

    exports.expand = function(str) {
        var arr = str.split(":");
        if (arr.length === 2 && nss.hasOwnProperty(arr[0])) {
            return nss[arr[0]]+arr[1];
        }
        return str;
    };

    exports.add = function(ns, full) {
        if (typeof ns === "string") {
            nss[ns] = full;
        } else if (typeof ns === "object") {
            for (var key in ns) if (ns.hasOwnProperty(key)) {
                nss[key] = ns[key];
            }
        }
    };

    exports.registry = function() {
        return nss;
    };

    return exports;
});
