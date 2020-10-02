# BREG-DCAT Creator

This is a proof of concept tool for the creation of RDF graphs that follow the DCAT Application profile for Base Registries in Europe (BRegDCAT-AP) v2 specification.

This tool will allow European public administrations to describe base registries in an easy-to-use web form, exporting these descriptions in BRegDCAT-AP v2 compliant machine-readable formats to store locally on a computer.

The tool is based on [RDForms 4.1 by MetaSolutionsAB](https://github.com/MetaSolutionsAB/rdforms/releases/tag/4.1), a JavaScript library that provides a way to declarative describe how the editor and presentation views of RDF should look like. The configuration mechanism eliminates the need for programming once the library has been deployed into an environment. The main task of RDForms is to make it easy to construct form-based RDF editors in a web environment. To accomplish this, RDForms relies on a templating mechanism that both describes how to generate a HTML-form and how to map specific expressions in a RDF graph to corresponding fields. Simply put, RDForm uses a template to construct the input-form for the user and its transformation to RDF.

## Deployment

### Docker

A self-contained [docker-compose](https://docs.docker.com/compose/install/) configuration file is provided to ease the deployment process:

    $ cd path_to_creator
    $ docker-compose up -d --build

### Local deployment

Before you can use the creator you need to make sure all the dependencies for RDForms are loaded and the library itself is built. To load the dependencies:

    $ cd path_to_creator
    $ npm   install
    $ bower install

This requires that you have [nodejs](http://nodejs.org/), [npm](https://www.npmjs.org/) and [bower](http://bower.io/) installed.

> npm installs nodejs libraries used by converters and a lightweight web server, while bower installs the client libraries such as dojo and rdfjson that RDForms builds upon. 

After having installed the dependencies, build RDForms. This is done by:

    $ cd path_to_creator/build
    $ ./build.sh

## Configuration

Due to the AJAX approach for loading dependencies you first have to allow your browser to do AJAX request from a file url,

in Firefox this is done by:
* Going into the config mode by typing about:config in the location bar
* Searching for and changing the security.fileuri.strict_origin_policy to false

In Chrome this is done by starting the browser with the following flag: --allow-file-access-from-files

## Usage instructions

Open the DCAT.html file in your standard web browser. 

Edit your description in the _editor_ tab, see the results in the present tab and download the resulting serialized RDF in the _RDF_ tab. Any changes you make in the _editor_ will be reflected in the other tabs. Created descriptions can be imported into the _RDF_ tab and then viewed (and edited as well) in the _editor_ tab.