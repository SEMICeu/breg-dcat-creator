/*global define*/
define("rdfjson/print", ["exports", "./namespaces"], function (exports, namespaces) {
    /**
     * @param {rdfjson.Graph} graph
     * @param {String} subject a URI for the subject to focus on
     */
    exports.pretty = function(graph, subject) {
        var pretty = {};
        var stmts = graph.find(subject);
        for (var i=0;i<stmts.length;i++) {
            var stmt = stmts[i];
            if (stmt.getType() != "bnode") {
                pretty[namespaces.shorten(stmt.getPredicate())] = stmt.getValue();
            }
        }
        return pretty;
    };

    exports.statementTree = function(graph, subject, visited) {
        visited = visited || {};
        var stmts = graph ? graph.find(subject) : [];
        var arr = [];
        for (var i=0;i<stmts.length;i++) {
            var stmt = stmts[i];
            if (stmt.getType() === "literal") {
                arr.push({stmt: stmt});
            } else {
                var row = {stmt: stmt};
                var obj = stmt.getValue();
                if (!visited[obj]) {
                    visited[obj] = true;
                    row.children = exports.statementTree(graph, obj, visited);
                }
            }
        }
        return arr;
    };

    exports.statementList = function(graph, subject) {
        var tree = exports.statementTree(graph, subject);
        var arr = [];
        var f = function(stmts, level) {
            for (var i = 0;i<stmts.length;i++) {
                var stmt = stmts[i];
                stmt.indent = level;
                arr.push(stmt);
                if (stmt.children) {
                    f(stmt.children, level +1);
                    delete stmt.children;
                }
            }
        };
        f(tree, 1);
        return arr;
    };

    exports.prettyTree = function(graph, subject) {
        var delegates = exports.statementList(graph, subject);
        for (var i=0;i<delegates.length;i++) {
            var delegate = delegates[i], stmt = delegate.stmt;
            if (stmt.isSubjectBlank()) {
                delegate.s = stmt.getSubject();
            } else {
                delegate.s = namespaces.shorten(stmt.getSubject());
            }
            delegate.p = namespaces.shorten(stmt.getPredicate());
            var t = stmt.getType();
            if (t === "uri") {
                delegate.o = namespaces.shorten(stmt.getValue());
                var lang = stmt.getLanguage(), dt = stmt.getDatatype();
                if (lang != null) {
                    delegate.o += "@@"+lang;
                } else if (dt != null) {
                    delegate.o += "^^"+dt;
                }
            } else if (t === "literal") {
                delegate.o = "\""+stmt.getValue()+"\"";
            } else {
                delegate.o = "\""+stmt.getValue()+"\"";
            }
        }
        return delegates;
    };
    return exports;
});