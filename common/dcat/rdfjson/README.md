# RDFJSON library
The RDFJSON library provides an RDF API with support for manipulating RDF graphs and individual statements.
Relies on the RDF/JSON representation internally. Provides both utility functionality for manipulating
the RDF/JSON expression directly and an object-oriented layer on top of it for simplified interactions.

## Getting started
To get the library you can clone it from [bitbucket](https://bitbucket.org/metasolutions/rdfjson), e.g.:

    git clone git@bitbucket.org:metasolutions/rdfjson.git

Second, to allow the tests to run and build the library you need to have [nodejs](http://nodejs.org/) and [npm](https://www.npmjs.org/) installed.

Third, to be able to build you need require.js and r.js installed, hence you need to run:

    npm install

Fourth, build the project (strictly speaking you can use the library directly, but it is often a good idea to bring the files together into a layer and optimize the code):

    cd build
    ./build.sh

Fifth, to make sure everything works as expected you can run the tests:

    cd tests
    ./runAllTests.sh

## Using the library
To create a simple graph and add statements you do the following:

    var g = new Graph({});
    g.addL("http://example.com", "dcterms:title", "A title");
    g.add("http://example.com", "dcters:relation", "http://example.org");

Now, to query the graph we use the find method which can have null in one, two or three places:

    var stmts = g.find(null, "dcterms:relation", null);
    console.log("Found a relation from " + stmts[0].getSubject() + " to " + stmts[0].getValue());

Please check the documentation in ```Graph.js``` and ```Statement.js``` or for that matter look at the tests.
You can also take a look at the samples.