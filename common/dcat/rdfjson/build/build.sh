#!/bin/bash

if [ ! -x "$(which node)" ] ; then
  if [ ! -x "$(which nodejs)" ] ; then
     echo "You need to install nodejs on your system before you can build!"
     exit
  else
     NODE="nodejs"
  fi
else
  NODE="node"
fi

if [ ! -x "../node_modules/requirejs/bin/r.js" ] ; then
   echo "You need to run 'npm install' in the parent directory first (repository root) so that requirejs is available."
   exit
fi

$NODE ../node_modules/requirejs/bin/r.js -o paths.rdfjson=.. include=rdfjson/Graph out=../release/rdfjson.js
$NODE ../node_modules/requirejs/bin/r.js -o paths.rdfjson=.. include=rdfjson/Graph,rdfjson/formats/converters,rdfjson/print,rdfjson/Rdfs out=../release/rdfjson-all.js
