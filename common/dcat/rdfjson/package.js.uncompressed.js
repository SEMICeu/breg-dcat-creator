//This file is useful for tagging which resources to include when using the dojo build system.
var profile = (function(){
    var testResourceRe = /\/tests\//;
    var ignore = /\/samples\//;
    return {
        resourceTags: {
            ignore: function(filename, mid) {
                return ignore.test(mid);
            },
            test: function(filename, mid) {
                return testResourceRe.test(mid);
            },
            amd: function(filename, mid) {
                return /\.js$/.test(filename) && !testResourceRe.test(mid);
            }
        }
    };
})();