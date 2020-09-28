/*global define,require*/
define("rdfjson/formats/converters", [
    "exports",
    "./rdfjson/util",
    "../Graph",
    "./rdfxml/terms",
    "./rdfxml/Rdfparser"
], function (exports, util, Graph, terms, Rdfparser) {

    var nss = {
        ical: "http://www.w3.org/2002/12/cal/ical#",
        role: "http://purl.org/role/terms/",
        dcterms: "http://purl.org/dc/terms/",
        rdfs: "http://www.w3.org/2000/01/rdf-schema#",
        rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
        owl: "http://www.w3.org/2002/07/owl#",
        vs: "http://www.w3.org/2003/06/sw-vocab-status/ns#",
        foaf: "http://xmlns.com/foaf/0.1/",
        wot: "http://xmlns.com/wot/0.1/",
        dc: "http://purl.org/dc/elements/1.1/"
    };
    var nscounter = 0;
    var sp = "  ";
    var sp2 = "    ";

    if (typeof window !== 'undefined' && (typeof window.DOMParser !== 'undefined' || typeof ActiveXObject !== 'undefined')) { //In browser

        exports.xml2string = function (xml) {
            return xml.xml;
        };

        exports.string2xml = function (text) {
            var doc;
	    try {
		if (window.DOMParser) {
                    var parser = new DOMParser();
                    doc = parser.parseFromString(text,"text/xml");
		} else { // Internet Explorer
                    doc=new ActiveXObject("Microsoft.XMLDOM");
                    doc.async = "false";
                    doc.loadXML(text);
                }
            } catch(e) {
		doc = null;
	    }
	    if ( !doc || !doc.documentElement || doc.getElementsByTagName( "parsererror" ).length ) {
		throw "Could not parse text as xml";
 	    }

	    return doc;
        };
    } else { //Not in browser
        // Non-browser environment, requires the XMLSerializer and xmldom libraries.
        exports.xml2string = function (xml) {
            return (new XMLSerializer()).serializeToString(xml);
        };

	if (require.has && require.has("host-node")) {
	    //Dojos bridge to nodejs own require 
	    require(['dojo/node!xmldom'], function(xmldom) {
		var DOMParser = xmldom["DOMParser"];	    
		exports.string2xml = function (text) {		
		    return new DOMParser().parseFromString(text, 'text/xml');
		};
	    });
	} else {
	    //Requirejs bridge to nodejs own require
	    exports.string2xml = function (text) {
		var DOMParser = require('xmldom')["DOMParser"];
		return new DOMParser().parseFromString(text, 'text/xml');
	    };
	}	
    }

    /**
     *
     * Imports RDF/XML into a Graph
     *
     * @param {Node|String} xml this is the XML document or XML string from where the RDF will be parsed.
     * @param {rdfjson.Graph|null} graph Where all tripples will be added, if null a new graph will be created.
     * @returns {rdfjson.Graph} where all found tripples have been added.
     */
    exports.rdfxml2graph = function (xml, graph) {

        if (util.isString(xml)) {
            xml = exports.string2xml(xml);
        }
        /**
         * @type {rdfjson.Graph}
         */
        var g = graph || new Graph({});
        var RDFFormula = terms.RDFFormula;
        var store = new RDFFormula();
        store.add = function (s, p, o) {
            var subj, pred, obj = {};
            //Subject
            if (s instanceof terms.RDFBlankNode) {
                subj = s.toString();
                g.registerBNode(subj);
            } else {
                subj = s.uri;
            }

            //Predicate
            if (p instanceof terms.RDFBlankNode) {
                pred = p.toString();
                g.registerBNode(pred);
            } else {
                pred = p.uri;
            }

            //Object
            if (o instanceof terms.RDFLiteral) {
                obj.type = "literal";
                obj.value = o.value;
                if (o.lang) {
                    obj.lang = o.lang;
                }
                if (o.datatype) {
                    obj.datatype = o.datatype.uri;
                }
            } else if (o instanceof terms.RDFSymbol) {
                obj.type = "uri";
                obj.value = o.uri;
            } else if (o instanceof terms.RDFBlankNode) {
                obj.value = o.toString();
                g.registerBNode(obj.value);
                obj.type = "bnode";
            }
            g.create(subj, pred, obj, true);
        };
        var parser = new Rdfparser(store);
        parser.parse(xml, "", "");
        return g;
    };
    exports.rdfjson2rdfxml = function (graph) {
        graph = graph instanceof Graph ? graph : new Graph(graph);
        var nsUsed = [], s, p, nsp, o, props, objs, i, g = graph._graph || graph; //just in case a Graph is provided.
        var nsAdded = {};
        var nsify = function (prop) {
            for (var ns in nss) {
                if (nss.hasOwnProperty(ns) && prop.indexOf(nss[ns]) === 0) {
                    if (!nsAdded[ns]) {
                        nsUsed.push(ns);
                        nsAdded[ns] = true;
                    }
                    return ns + ":" + prop.substring(nss[ns].length);
                }
            }
            var slash = prop.lastIndexOf("/");
            var hash = prop.lastIndexOf("#");
            if (hash > slash) {
                slash = hash;
            }
            nscounter++;
            ns = "ns" + nscounter;
            nss[ns] = prop.substring(0, slash + 1);
            nsUsed.push(ns);
            nsAdded[ns] = true;
            return ns + ":" + prop.substring(slash + 1);
        };

        var strs = [];
        for (s in g) {
            if (g.hasOwnProperty(s)) {
                if (s.substr(0, 2) === "_:") {
                    strs.push(sp + '<rdf:Description rdf:nodeID="_' + s.substring(2) + '">\n');
                } else {
                    strs.push(sp + '<rdf:Description rdf:about="' + s + '">\n');
                }
                props = g[s];
                for (p in props) {
                    if (props.hasOwnProperty(p)) {
                        objs = props[p];
                        nsp = nsify(p);
                        for (i = 0; i < objs.length; i++) {
                            o = objs[i];
                            switch (o.type) {
                                case "literal":
                                    var v = o.value.replace("&", "&amp;").replace("<", "&lt;");
                                    if (o.lang != null) {
                                        strs.push(sp2 + '<' + nsp + ' xml:lang="' + o.lang + '">' + v + '</' + nsp + '>\n');
                                    } else if (o.datatype != null) {
                                        strs.push(sp2 + '<' + nsp + ' rdf:datatype="' + o.datatype + '">' + v + '</' + nsp + '>\n');
                                    } else {
                                        strs.push(sp2 + '<' + nsp + '>' + v + '</' + nsp + '>\n');
                                    }
                                    break;
                                case "uri":
                                    strs.push(sp2 + '<' + nsp + ' rdf:resource="' + o.value + '"/>\n');
                                    break;
                                case "bnode":
				    if (o.value.substr(0, 2) === "_:") {
					strs.push(sp2 + '<' + nsp + ' rdf:nodeID="_' + o.value.substring(2) + '"/>\n');
				    } else {
					strs.push(sp2 + '<' + nsp + ' rdf:nodeID="' + o.value + '"/>\n');
				    }
                                    break;
                            }
                        }
                    }
                }
                strs.push(sp + '</rdf:Description>\n');
            }
        }
        var initialStrs = ['<?xml version="1.0"?>\n<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"'];
        for (var j = 0; j < nsUsed.length; j++) {
            if (nsUsed[j] !== "rdf") {
                initialStrs.push('\n\txmlns:' + nsUsed[j] + '="' + nss[nsUsed[j]] + '"');
            }
        }
        initialStrs.push('>\n');
        strs.unshift(initialStrs.join(""));
        strs.push('</rdf:RDF>');
        return strs.join("");
    };

    /**
     * Detects RDF as a string in the RDF/XML, as an instance of Graph or as a object literal
     * corresponding to a RDF/JSON structure.
     * Limitation: Parse JSON strings into object literals if the JSON.parse is available in the environment.
     *
     * @param {string|object} rdf in RDF/XML, RDF/JSON or a object literal corresponding to already parsed RDF/JSON.
     * @returns {Object} a report with the attributes: graph, format and potentially an error.
     */
    exports.detect = function(rdf) {
        var report = {};
        if (typeof rdf === "string") {
            var taste = rdf.substr(0,100);
            if (taste.substr(0,100).toLowerCase().indexOf("<rdf:rdf") !== -1) {
                report.format = "rdf/xml";
                try {
                    report.graph = exports.rdfxml2graph(rdf);
                } catch (e) {
                    report.error = "Invalid rdf/xml";
                }
            } else if (rdf.substring(0,2) === "{\"") {
                report.format = "rdf/json";
                if (typeof JSON === "undefined" || typeof JSON.parse !== "function") {
                    throw "Cannot parse rdf/json since the standard JSON parser is not available.";
                }
                try {
                    var jsonrdf = JSON.parse(this.rdfjson);
                    report.graph = new Graph(jsonrdf);
                } catch(e) {
                    report.error = "Invalid json.";
                }
            } else {
                report.error = "No RDF detected.";
            }
        } else if (rdf instanceof Graph) {
            report.format = "rdf/json";
            report.graph = rdf;
        } else if (lang.isObject(rdf)) {
            report.format = "rdf/json";
            report.graph = new Graph(rdf);
        } else {
            report.error = "unknown format";
        }
        if (!report.error) {
            var r = report.graph.validate();
            if (!r.valid) {
                report.error = "RDF/JSON is not valid.";
            }
        }
        return report;
    };

    exports.namespaces = function() {
        return nss;
    };
    exports.addNamespace = function(ns, expanded) {
        nss[ns] = expanded;
    };
});
