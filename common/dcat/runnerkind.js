//#!/usr/bin/env node

var requirejs = require('requirejs');
requirejs.config({ nodeRequire: require, baseUrl: '.' });

var conf = {

    source: "kind.rdf",
    // destination: "dcat2.json",
    // destination: "/home/alvaro/Development/Projects/dcat-breg/cpsv-ap_creator/template/DCATtemplate.json",
    destination: "../../template/kind.json",
    ns: "http://www.w3.org/ns/dcat#",
    root: "dcat:Catalog",
    abbrev: "dcat",
    literalNodeTypeDefault: "ONLY_LITERAL",
    nonGroupCardinalityDefault: { pref: 1 },
    datatypeBases: ["http://www.w3.org/2001/XMLSchema#"],
    typeForUnknownRange: "choice",
    major: ["Catalog", "Agent", "Dataset", "Literal", "Resource", "Concept", "Distribution", "LicenseDocument", "ConceptScheme", "CatalogRecord", "Checksum", "Document", "Frequency", "Identifier", "Kind", "LinguisticSystem", "Location", "MediaType", "PeriodOfTime", "RightsStatement", "ProvenanceStatement", "Standard", "DataService", "Relationship", "Role"],
    allClassesMajor: true,
    ignoreAllClasses: false,
    ignoreAllProperties: false,
    ignore: [],
    order: [],
    categories: [],

};

requirejs(['fs', 'rdfjson/Graph', 'rdfjson/formats/converters', 'rdforms/converters/RDFS/converter'],
    function (fs, Graph, conv, rdfsconv) {
        fs.readFile(conf.source, 'utf8', function (err, data) {
            var graph = conv.rdfxml2graph(data);
            var sirf = rdfsconv.convert(graph, conf);
            var fd = fs.openSync(conf.destination, "w");
            fs.writeSync(fd, JSON.stringify(sirf, true, 1), 0, "utf8");
        });
    }
);