require({cache:{
'url:rdforms/formulator/ItemEditorTemplate.html':"<div>\n    <div class=\"formulatorTable\">\n        <div class=\"row\"><label for=\"${id}_type\">Type:</label><div><div id=\"${id}_type\" data-dojo-type=\"dijit/form/TextBox\" data-dojo-attach-point=\"_typeDijit\" data-dojo-props=\"disabled: true\"></div></div></div>\n        <div class=\"row\"><label for=\"${id}_id\">Id:</label><div><div id=\"${id}_id\" data-dojo-type=\"dijit/form/TextBox\" data-dojo-attach-point=\"_idDijit\" data-dojo-attach-event=\"onChange: _changeId\" data-dojo-props=\"intermediateChanges: true\"></div></div></div>\n        <div class=\"row\"><label for=\"${id}_extends\">Extends:</label>\n            <div data-dojo-type=\"dojo/dnd/Target\" data-dojo-attach-point=\"_extends_target\" data-dojo-props=\"accept: ['treenode', 'text']\">\n                <div id=\"${id}_extends\" data-dojo-type=\"dijit/form/TextBox\" data-dojo-attach-point=\"_extendsDijit\" data-dojo-attach-event=\"onChange: _changeExtends\" data-dojo-props=\"intermediateChanges: true\"></div>\n            </div>\n        </div>\n        <div class=\"row\"><label for=\"${id}_property\">Property:</label><div><div id=\"${id}_property\" data-dojo-type=\"dijit/form/TextBox\" data-dojo-attach-point=\"_propDijit\" data-dojo-attach-event=\"onChange: _changeProperty\" data-dojo-props=\"intermediateChanges: true\"></div></div></div>\n        <div class=\"row\"><label for=\"${id}_nt\">NodeType:</label><div>\n            <select class=\"select\" name=\"select1\" data-dojo-type=\"dijit/form/Select\" id=\"${id}_nt\" data-dojo-attach-point=\"_ntDijit\" data-dojo-attach-event=\"onChange: _changeNT\">\n                <option value=\"LANGUAGE_LITERAL\">Literal, language mandatory</option>\n                <option value=\"PLAIN_LITERAL\">Literal, language optional</option>\n                <option value=\"ONLY_LITERAL\">Literal, language disallowed</option>\n                <option value=\"DATATYPE_LITERAL\">Datatyped literal</option>\n                <option value=\"LITERAL\" selected=\"selected\">Any kind of literal</option>\n                <option value=\"URI\">URI</option>\n                <option value=\"BLANK\">Blank node</option>\n                <option value=\"RESOURCE\">URI or blank node</option>\n            </select>\n        </div></div>\n        <div class=\"row\"><label for=\"${id}_dt\">DataType:</label><div>\n            <select class=\"select\" data-dojo-type=\"dijit/form/ComboBox\" id=\"${id}_dt\" name=\"dt\" data-dojo-attach-point=\"_dtDijit\" data-dojo-attach-event=\"onChange: _changeDT\">\n                <option selected></option>\n                <option>http://www.w3.org/2001/XMLSchema#date</option>\n                <option>http://www.w3.org/2001/XMLSchema#duration</option>\n                <option>http://www.w3.org/2001/XMLSchema#decimal</option>\n                <option>http://www.w3.org/2001/XMLSchema#integer</option>\n                <option>http://www.w3.org/2001/XMLSchema#boolean</option>\n            </select>\n        </div></div>\n        <div class=\"row\"><label for=\"${id}_pattern\">Pattern:</label><div><div id=\"${id}_pattern\" data-dojo-type=\"dijit/form/TextBox\" data-dojo-attach-point=\"_patternDijit\" data-dojo-attach-event=\"onChange: _changePattern\" data-dojo-props=\"intermediateChanges: true\"></div></div></div>\n        <div class=\"row\"><label>Label: <span data-dojo-attach-point=\"_addLabel\" class=\"addButton\">+</span></label><div>\n            <div data-dojo-attach-point=\"_labelLangString\" data-dojo-type=\"rdforms/formulator/LangString\"></div>\n        </div></div>\n        <div class=\"row\"><label>Description: <span data-dojo-attach-point=\"_addDesc\" class=\"addButton\">+</span></label><div>\n            <div data-dojo-attach-point=\"_descLangString\" data-dojo-type=\"rdforms/formulator/LangString\" data-dojo-props=\"multiline: true\"></div>\n        </div></div>\n        <div class=\"row\"><label>Cardinality: </label><div><div class=\"cardinality\">\n            <label for=\"${id}_min\">Min:</label><div id=\"${id}_min\" data-dojo-type=\"dijit/form/NumberTextBox\" data-dojo-attach-point=\"_minDijit\" data-dojo-attach-event=\"onChange: _changeCard\"></div>\n            <label for=\"${id}_pref\">Pref:</label><div id=\"${id}_pref\" data-dojo-type=\"dijit/form/NumberTextBox\" data-dojo-attach-point=\"_prefDijit\" data-dojo-attach-event=\"onChange: _changeCard\"></div>\n            <label for=\"${id}_max\">Max:</label><div id=\"${id}_max\" data-dojo-type=\"dijit/form/NumberTextBox\" data-dojo-attach-point=\"_maxDijit\" data-dojo-attach-event=\"onChange: _changeCard\"></div>\n        </div></div></div>\n        <div class=\"row\"><label for=\"${id}_constr\">Constraints:</label><div><div id=\"${id}_constr\" data-dojo-type=\"dijit/form/ValidationTextBox\" data-dojo-attach-point=\"_constrDijit\" data-dojo-attach-event=\"onChange: _changeConstr\" data-dojo-props=\"intermediateChanges: true, invalidMessage: 'Must be a valid json string.'\"></div></div></div>\n        <div class=\"row\"><label for=\"${id}_cls\">Classes:</label><div><div id=\"${id}_cls\" data-dojo-type=\"dijit/form/TextBox\" data-dojo-attach-point=\"_clsDijit\" data-dojo-attach-event=\"onChange: _changeCls\" data-dojo-props=\"intermediateChanges: true\"></div></div></div>\n        <div class=\"row\"><label for=\"${id}_sty\">Styles:</label><div><div data-dojo-attach-point=\"_stylesWrapper\">\n        </div></div></div>\n    </div>\n</div>\n"}});
/*global define*/
define("rdforms/formulator/ItemEditor", [
    "dojo/_base/lang",
    "dojo/_base/array",
    "dojo/_base/declare",
    "dojo/aspect",
	"dojo/on",
    "dojo/json",
    "dojo/dom-construct",
    "dijit/_WidgetBase",
    "dijit/registry",
    "dijit/form/ComboBox",
    "rdforms/formulator/LangString",
    "rdforms/template/Item",
	"dijit/_TemplatedMixin",
	"dijit/_WidgetsInTemplateMixin",
    "dijit/form/ToggleButton", //For template
    "dojo/dnd/Target",
	"dojo/text!./ItemEditorTemplate.html"
], function(lang, array, declare, aspect, on, json, construct, _WidgetBase, registry, ComboBox, LangString,
            Item, _TemplatedMixin, _WidgetsInTemplateMixin, ToggleButton, Target, template) {


    return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
        //===================================================
        // Public attributes
        //===================================================
        itemStore: null,
        storeManager: null,

        //===================================================
        // Inherited attributes
        //===================================================
        templateString: template,

        //===================================================
        // Inherited methods
        //===================================================
        postCreate: function() {
            this.inherited("postCreate", arguments);
            this.lock = true;
            var readOnly = this.item.getBundle().isReadOnly()
            this._styles2Dijit = {};
            var styles= this.item.getAvailableStyles();
            var f = lang.hitch(this, this._changeStyles);
            for (var i=0;i< styles.length;i++) {
                var style = styles[i];
                this._styles2Dijit[style] = new ToggleButton({
                    showLabel: true,
                    disabled: readOnly,
                    checked: this.item.hasStyle(style),
                    onChange: f,
                    label: style,
                    iconClass:'dijitCheckBoxIcon'
                }, construct.create("div", null, this._stylesWrapper));
            }

            this._typeDijit.set("value", this.item.getType(true) || "");
            this._extendsDijit.set("value", this.item.getExtends(true) || "");
            this._propDijit.set("value", this.item.getProperty(true) || "");
            this._ntDijit.set("value", this.item.getNodetype(true) || "");
            this._dtDijit.set("value", this.item.getDatatype(true) || "");
            this._patternDijit.set("value", this.item.getPattern(true) || "");
            var card = this.item.getCardinality(true);
            this._minDijit.set("value", card.min || "");
            this._prefDijit.set("value", card.pref || "");
            this._maxDijit.set("value", card.max || "");
            this._constrDijit.set("value", json.stringify(this.item.getConstraints(true) || {}));
            this._clsDijit.set("value", this.item.getClasses(true).join(", "));
            setTimeout(lang.hitch(this, function() {
                this.lock = false;
            }), 200);
            if (readOnly) {
                array.forEach(["_idDijit", "_typeDijit", "_extendsDijit", "_propDijit", "_ntDijit", "_dtDijit",
                    "_patternDijit", "_labelLangString", "_descLangString", "_minDijit", "_prefDijit", "_maxDijit",
                    "_constrDijit", "_clsDijit"], function(wid) {
                    this[wid].set("disabled", "true");
                }, this);
            } else {
                var id = this.item.getId(true);
                if (id == null) {
                    this._idDijit.set("disabled", "true");
                } else {
                    this._idDijit.set("value", id);
                }
                this._dtDijit.set("disabled", this.item.getNodetype(true) !== "DATATYPE_LITERAL");
                this._patternDijit.set("disabled", this.item.getNodetype(true) !== "ONLY_LITERAL");
                aspect.before(this._labelLangString, "onChange", lang.hitch(this.item, "setLabelMap"));
                aspect.after(this._labelLangString, "onChange", lang.hitch(this, this.itemChanged));
                on(this._addLabel, "click", lang.hitch(this._labelLangString, this._labelLangString.add));
                aspect.before(this._descLangString, "onChange", lang.hitch(this.item, "setDescriptionMap"));
                aspect.after(this._descLangString, "onChange", lang.hitch(this, this.itemChanged));
                on(this._addDesc, "click", lang.hitch(this._descLangString, this._descLangString.add));
                this._constrDijit.set("disabled", this.item.getType(true) === "text" || (this.item.getNodetype(true) !== "URI" && this.item.getNodetype(true) !== "RESOURCE"));
                this._constrDijit.validator = function(value, constraints){
                    try {
                        if (value !== "{}" && value !== "") {
                            var obj = json.parse(value);
                        }
                        return true;
                    } catch(e) {
                        return false;
                    }
                }

                this._extends_target.checkAcceptance = function(source, nodes) {
                    if (nodes.length === 1) {
                        var tn = registry.getEnclosingWidget(nodes[0]);
                        return tn.item instanceof Item;
                    }

                    return false;
                };
                this._extends_target.onDrop = lang.hitch(this, function(source, nodes, copy) {
                    var tn = registry.getEnclosingWidget(nodes[0]);
                    this._extendsDijit.set("value", tn.item.getId());
                });
            }
            this._labelLangString.setMap(this.item.getLabelMap(true));
            this._descLangString.setMap(this.item.getDescriptionMap(true));

//            this._styDijit.set("value", json.stringify(this.item.getStyles() || {}));
        },
        itemChanged: function() {
            this.storeManager.itemChanged(this.item);
        },
        //===================================================
        // Private methods
        //===================================================
        _addLangString: function(node, onChange) {
        },
        _changeId: function() {
            if (this.lock) {
                return;
            }
            if (this._idTimer) {
                clearTimeout(this._idTimer);
            }
            this._idTimer = setTimeout(lang.hitch(this, function() {
                delete this._idTimer;
                if (this._destroyed) {
                    return;
                }
                var from = this.item.getId(), to = this._idDijit.get("value");
                if (from !== to) {
                    try {
                        this.itemStore.renameItem(from, to);
                        this.itemChanged();
                    } catch (e) {
                        //Silently ignore non-acceptable changes
                    }
                }
            }), 200);
        },
        _changeExtends: function() {
            if (this.lock) {
                return;
            }
            this.item.setExtends(this._extendsDijit.get("value"));
            this.itemChanged();
        },
        _changeProperty: function() {
            if (this.lock) {
                return;
            }
            this.item.setProperty(this._propDijit.get("value"));
            this.storeManager.itemChanged(this.item);
        },
        _changeNT: function() {
            if (this.lock) {
                return;
            }
            var nt = this._ntDijit.get("value");
            this.item.setNodetype(nt);
            this._dtDijit.set("disabled", nt !== "DATATYPE_LITERAL");
            this._patternDijit.set("disabled", nt !== "ONLY_LITERAL");
            this._constrDijit.set("disabled", this.item.getType(true) === "text" || (this.item.getNodetype(true) !== "URI" && this.item.getNodetype(true) !== "RESOURCE"));
            this.itemChanged();
        },
        _changeDT: function() {
            if (this.lock) {
                return;
            }
            this.item.setDatatype(this._dtDijit.get("value"));
            this.itemChanged();
        },
        _changePattern: function() {
            if (this.lock) {
                return;
            }
            this.item.setPattern(this._patternDijit.get("value"));
            this.itemChanged();
        },
        _changeCard: function() {
            if (this.lock) {
                return;
            }
            var card = {
                "min": this._minDijit.get("value") || 0,
                "pref": this._prefDijit.get("value") || 0,
                "max": this._maxDijit.get("value") || -1
            }
            if (card.max === -1) {
                delete card.max;
            }
            this.item.setCardinality(card);
            this.itemChanged();
        },
        _changeConstr: function() {
            if (this.lock) {
                return;
            }
            try {
                var val = this._constrDijit.get("value");
                if (val === "{}" || val === "") {
                    this.item.setConstraints();
                } else {
                    var obj = json.parse(val);
                    this.item.setConstraints(obj);
                }
                this.itemChanged();
            } catch(e) {
            }
        },
        _changeCls: function() {
            if (this.lock) {
                return;
            }
            var val = this._clsDijit.get("value");
            var arr = val.replace(/[,;:] ?/, " ").split(" ");
            if (arr.length === 1 && arr[0] === "") {
                this.item.setClasses();
            } else {
                this.item.setClasses(arr);
            }
            this.itemChanged();
        },
        _changeStyles: function() {
            if (this.lock) {
                return;
            }
            var styles= this.item.getAvailableStyles();
            var arr = [];
            for (var i=0;i< styles.length;i++) {
                var style = styles[i];
                if (this._styles2Dijit[style].get("checked")) {
                    arr.push(style);
                }
            }
            this.item.setStyles(arr);
            this.itemChanged();
        }
    });
});