require({cache:{
'url:rdforms/view/ChooserTemplate.html':"<div>\n    <div data-dojo-type=\"dijit/Dialog\" autofocus=\"true\" data-dojo-attach-point=\"dialog\">\n        <div data-dojo-type=\"dijit/layout/BorderContainer\" data-dojo-props=\"design:'sidebar',gutters: 'false'\" data-dojo-attach-point=\"bc\" class=\"chooser rforms\">\n            <div data-dojo-type=\"dijit/layout/ContentPane\" data-dojo-attach-point=\"cpLeft\" data-dojo-props=\"region:'left',splitter:'true'\" style=\"width: 60%; height: 100%\">\n                <div data-dojo-attach-point=\"selectionNode\"  style=\"height:100%\"></div>\n            </div>\n            <div data-dojo-type=\"dijit/layout/ContentPane\" data-dojo-props=\"region:'center'\">\n                <h2>Selected item</h2>\n                <div>\n                    <label>Idenditier:</label>\n                    <span data-dojo-attach-point=\"uriNode\" class=\"uriNode\"></span>\n                </div>\n                <div>\n                    <label>Label:</label>\n                    <span data-dojo-attach-point=\"labelNode\" class=\"labelNode\"></span>\n                </div>\n                <label>Description:</label>\n                <div data-dojo-attach-point=\"descriptionNode\"  class=\"descriptionNode\"></div>\n            </div>\n            <div data-dojo-type=\"dijit/layout/ContentPane\" data-dojo-attach-point=\"cpBottom\" data-dojo-props=\"region:'bottom'\">\n                <div class=\"buttonRow\">\n                    <div data-dojo-type=\"dijit/form/Button\" data-dojo-attach-point=\"cancelButton\" data-dojo-attach-event=\"onClick: _cancelClicked\" label=\"cancel\"></div>\n                    <div data-dojo-type=\"dijit/form/Button\" data-dojo-attach-point=\"doneButton\" disabled=\"true\" data-dojo-attach-event=\"onClick: _doneClicked\" label=\"done\"></div>\n                </div>\n            </div>\n        </div>\n    </div>\n</div>\n"}});
/*global define*/
define("rdforms/view/Chooser", ["dojo/_base/declare",
    "dojo/dom-attr",
    "dojo/dom-style",
    "dojo/window",
    "dijit/_WidgetBase",
    "dijit/_TemplatedMixin",
    "dijit/_WidgetsInTemplateMixin",
    "dijit/Dialog",
    "dijit/layout/ContentPane",
    "dijit/layout/BorderContainer",
    "dijit/form/Button",
    "../utils",
    "dojo/text!./ChooserTemplate.html"
], function (declare, attr, style, window, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin,
             Dialog, ContentPane, BorderContainer, Button, utils, template) {

    return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
        templateString: template,
        binding: null,

        //===================================================
        // Public API
        //===================================================
        show: function () {
            this._selectChoice(this.binding.getChoice());
            var viewport = window.getBox();
            style.set(this.bc.domNode, {
                width: Math.floor(viewport.w * 0.70) + "px",
                height: Math.floor(viewport.h * 0.70) + "px",
                overflow: "auto",
                position: "relative"    // workaround IE bug moving scrollbar or dragging dialog
            });
            this.bc.resize();
            this.dialog.show();
        },

        //===================================================
        // Public hooks
        //===================================================
        done: function () {
        },

        //===================================================
        // Private methods
        //===================================================
        _cancelClicked: function () {
            this.dialog.hide();
        },
        _doneClicked: function () {
            this.binding.setChoice(this.selected);
            this.dialog.hide();
            this.done(this.selected);
        },

        _selectChoice: function (choice) {
            if (choice == null) {
                delete this.selected;
                attr.set(this.uriNode, "innerHTML", "");
                attr.set(this.labelNode, "innerHTML", "");
                attr.set(this.descriptionNode, "innerHTML", "");
            } else {
                this.selected = choice;
                attr.set(this.uriNode, "innerHTML", this.selected.value);
                attr.set(this.labelNode, "innerHTML", utils.getLocalizedValue(choice.label).value || "(No label given.)");
                attr.set(this.descriptionNode, "innerHTML", utils.getLocalizedValue(choice.description).value || "");
                if (choice.selectable !== false && (this.binding.getChoice() == null || this.binding.getChoice().value !== this.selected.value)) {
                    this.doneButton.set("disabled", false);
                } else {
                    this.doneButton.set("disabled", true);
                }
            }
        }
    });
});