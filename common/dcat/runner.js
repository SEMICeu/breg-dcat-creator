//#!/usr/bin/env node

var requirejs = require('requirejs');
requirejs.config({ nodeRequire: require, baseUrl: '.' });

var conf = {
    source: "dcat2-en.rdf",
    destination: "../../template/DCATtemplate.json",
    ns: "http://www.w3.org/ns/dcat#",
    root: "dcat:Catalog",
    abbrev: "dcat",
    literalNodeTypeDefault: "DATATYPE_LITERAL",
    nonGroupCardinalityDefault: {
        pref: 1,
    },
    typeForUnknownRange: "choice",
    major: [
    "Label Property",
    "Person",
    "Organization",
    "Group",
    "Project",
    "Image",
    "PersonalProfileDocument",
    "Online Account",
    "Online Gaming Account",
    "Online E-commerce Account",
    "Online Chat Account",
    "Class",
    "Container",
    "ContainerMembershipProperty",
    "Datatype",
    "Catalog",
    "Agent",
    "Dataset",
    "Literal",
    "Resource",
    "Concept",
    "Distribution",
    "LicenseDocument",
    "ConceptScheme",
    "CatalogRecord",
    "Checksum",
    "Document",
    "Frequency",
    "Identifier",
    "Kind",
    "LinguisticSystem",
    "Location",
    "MediaType",
    "PeriodOfTime",
    "RightsStatement",
    "ProvenanceStatement",
    "Standard",
    "DataService",
    "Relationship",
    "Role",
    "PublicService",
    "Rule",
    "PublicOrganization",
    "LegalResource",
"Address",
"Geometry"],
    allClassesMajor: false,
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