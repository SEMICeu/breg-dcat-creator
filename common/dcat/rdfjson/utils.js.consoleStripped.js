define("rdfjson/utils", [
    'rdfjson/Graph'
], function (Graph) {
    var utils = {
        /**
         * Copies over a subset of statements from one metadata graph to another.
         * The statements copied are those with the provided uri in subject position, or
         * statements reachable via intermediate blank nodes from that uri.
         * Statements are not copied over if the predicate is listed in the ignore array.
         *
         * @param {rdfjson/Graph} inGraph graph which holds rdf data in graph format
         * @param {string} uri a starting point to find all statements to include
         * @param {object=} ignore is an object with predicates as attributes,
         * which are to be ignored (excluded)
         * @param {rdfjson/Graph=} outGraph optional graph which will hold copied statements,
         *  if no outGraph is provided a new will be created.
         * @return {rdfjson/Graph} same as the provided outGraph
         */
        extract: function (inGraph, uri, ignore, outGraph) {
            outGraph = outGraph || new Graph();
            ignore = ignore || {};
            var stmts = inGraph.find(uri, null, null);
            for (var i = 0; i < stmts.length; i++) {
                var stmt = stmts[i];
                if (!ignore[stmt.getPredicate()]) {
                    outGraph.add(stmts[i]);
                    if (stmt.getType() === "bnode") {
                        utils.extract(inGraph, outGraph, stmt.getValue(), ignore);
                    }
                }
            }
            return outGraph;
        },
        /**
         * Removes an entire subgraph from a given graph.
         * The subgraph is calculated by traversing triples in the forward direction
         * from a starting resource. A triple is included in the subgraph if it can be reached
         * via a path of triples from the starting resource that only passes triples that have
         * blank nodes in object position. The triples in the path may not include predicates
         * in the ignore list except the last triple in the path.
         *
         * @param {rdfjson/Graph} graph the graph to remove triples from
         * @param {string} uri the starting resource to calculate the subgraph from
         * @param {object} ignore an hash of predicates (with the boolean true as value)
         * to ignore when calculating the subgraph to remove, see explanation above.
         */
        remove: function(graph, uri, ignore) {
            ignore = ignore || {};
            var stmts = graph.find(uri, null, null);
            for (var i = 0; i < stmts.length; i++) {
                var stmt = stmts[i];
                graph.remove(stmt);
                if (!ignore[stmt.getPredicate()]) {
                    if (stmt.getType() === "bnode") {
                        utils.remove(graph, stmt.getValue(), ignore);
                    }
                }
            }
        }
    };
    return utils;
});
