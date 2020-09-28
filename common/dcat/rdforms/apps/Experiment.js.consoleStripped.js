require({cache:{
'url:rdforms/apps/ExperimentTemplate.html':"<div>\n  <div data-dojo-type='dijit/layout/TabContainer' data-dojo-attach-point='_tabContainer' style='height: 100%' data-dojo-props=\"gutters:false\">\n    <div data-dojo-type='dijit/layout/ContentPane' title='Editor' data-dojo-props=\"selected:'true'\" data-dojo-attach-point='_editorTab'>\n        <div data-dojo-type=\"rdforms/view/Editor\" data-dojo-attach-point=\"editor\" data-dojo-props=\"compact: true,includeLevel: 'optional'\"></div>\n    </div>\n    <div data-dojo-type='dijit/layout/ContentPane' title='Presenter' data-dojo-attach-point='_presenterTab'>\n        <div data-dojo-type=\"rdforms/view/Presenter\" data-dojo-attach-point=\"presenter\" data-dojo-props=\"compact: true\"></div>\n    </div>\n    <div data-dojo-type='dijit/layout/ContentPane' title='Template' data-dojo-attach-point='_templateTab'>\n      <div data-dojo-type='dijit/form/SimpleTextarea' data-dojo-attach-point='_templateView' style='padding: 0px; margin: 0px;height: 100%; width: 100%; overflow:auto;'></div>\n    </div>\n    <div data-dojo-type='rdforms/apps/RDFView' title='RDF data' data-dojo-attach-point='_rdfTab'></div>\n  </div>\n</div>\n"}});
/*global define*/
define("rdforms/apps/Experiment", ["dojo/_base/declare", 
	"dojo/_base/lang",
    "dojo/topic",
	"dojo/dom-construct",
	"dojo/json",
	"dijit/layout/_LayoutWidget",
	"dijit/_TemplatedMixin",
	"dijit/_WidgetsInTemplateMixin",
    "dijit/layout/TabContainer",
	"rdfjson/Graph",
	"../model/Engine",
	"../template/ItemStore",
	"../view/Editor",
	"../view/Presenter",
    "./RDFView",
	"dojo/text!./ExperimentTemplate.html"
], function(declare, lang, topic, construct, json, _LayoutWidget,  _TemplatedMixin, _WidgetsInTemplateMixin, TabContainer, Graph, Engine, ItemStore, Editor, Presenter, RDFView, template) {

    return declare([_LayoutWidget, _TemplatedMixin, _WidgetsInTemplateMixin], {
	//===================================================
	// Public attributes
	//===================================================
	templateObj: "",
	graphObj: "",
    graph: null,
	itemStore: null,
	template: null,
    resource: "http://www.w3.org/ns/dcat#",
	hideTemplate: false,

	//===================================================
	// Inherited attributes
	//===================================================
	templateString: template, 

	
	//===================================================
	// Inherited methods
	//===================================================
	startup: function() {
	    this.inherited("startup", arguments);
	    this._itemStore = this.itemStore || new ItemStore();
	    if (this.showTemplateSource) {}
	    this._template = this.template || this._itemStore.createTemplate(this.templateObj);
	    this._templateInvalid = false;
	    if (this.hideTemplate) {
		this._tabContainer.removeChild(this._templateTab);
	    } else {
		this._templateView.set("value", json.stringify(this.templateObj, true, "  "));
	    }

        if (this.graph == null) {
            this.graph = new Graph(this.graphObj);
        }
	    this._graphInvalid = false;
	    topic.subscribe(this._tabContainer.id+"-selectChild", lang.hitch(this, this._selectChild));
	    this._initEditor();
	},
	resize: function( ){
	    this.inherited("resize", arguments);
	    if (this._tabContainer) {
		this._tabContainer.resize();			
	    }
	},
	//===================================================
	// Private methods
	//===================================================	
	_selectChild: function(child) {
        this._updateGraph();
        this._updateTemplate();
        if(child === this._rdfTab) {
            this._rdfTab.setGraph(this.graph);
            this._graphInvalid = true;
        } else if(child === this._templateTab) {
            this._templateInvalid = true;
        } else if (child === this._editorTab) {
            this._initEditor();
        } else if (child === this._presenterTab) {
            this._initPresenter();
        }
	},
	_updateTemplate: function() {
		if (this._templateInvalid) {
			try {
				this._template = this._itemStore.createTemplate(json.parse(this._templateView.get("value")));
				this._templateInvalid = false;
			} catch (e) {
				alert("Error in template.");
			}
		}
	},
	_updateGraph: function() {
		if (this._graphInvalid) {
			try {
				this.graph = this._rdfTab.getGraph();
				this._graphInvalid = false;
			} catch (e) {
				alert("Error in rdf.");
				return;
			}
		}
	},
	_initEditor: function() {
		this.editor.show({template: this._template, graph: this.graph, resource: this.resource});
	},
		
	_initPresenter: function() {
        this.presenter.show({template: this._template, graph: this.graph, resource: this.resource});
	}
    });
});