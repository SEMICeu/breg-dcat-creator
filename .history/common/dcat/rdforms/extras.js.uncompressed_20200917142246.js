require({cache:{
'rdforms/formulator/StoreManager':function(){
/*global define*/
define(["dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/request/xhr",
    "dojo/on",
    "dojo/dom-class",
    "dojo/dom-construct",
    "dojo/dom-attr",
    "dojo/_base/array",
    "dojo/json",
    "dijit/registry",
    "dijit/layout/_LayoutWidget",
    "dijit/_TemplatedMixin",
    "dijit/_WidgetsInTemplateMixin",
    "dojo/dnd/Source",
    "dijit/tree/dndSource",
    "dijit/Tree",
    "dijit/Menu",
    "dijit/MenuItem",
    "dijit/MenuSeparator",
    "dijit/layout/ContentPane", //For template
    "dijit/layout/TabContainer", //For template
    "dijit/layout/BorderContainer", //For template
    "dijit/form/Button", //For template
    "./ItemEditor",
    "./ItemTreeModel",
    "./ChoicesEditor",
    "../template/Bundle",
    "../template/Group",
    "../template/Choice",
    "../apps/Experiment",
    "dojo/text!./StoreManagerTemplate.html"
], function (declare, lang, xhr, on, domClass, construct, attr, array, json, registry, _LayoutWidget, _TemplatedMixin, _WidgetsInTemplateMixin,
             DnDSource, TreeDndSource, Tree, Menu, MenuItem, MenuSeparator, ContentPane, TabContainer, BorderContainer, Button,
             ItemEditor, ItemTreeModel, ChoicesEditor, Bundle, Group, Choice, Experiment, template) {


    return declare([_LayoutWidget, _TemplatedMixin, _WidgetsInTemplateMixin], {
        //===================================================
        // Public attributes
        //===================================================
        itemStore: null,

        //===================================================
        // Inherited attributes
        //===================================================
        templateString: template,

        //===================================================
        // Inherited methods
        //===================================================
        postCreate: function () {
            this.inherited("postCreate", arguments);
            this.itemStore.automaticSortAllowed = false;
            this._buildTree();
//            on(this._listNode, "click", lang.hitch(this, this._itemIdClicked));
        },
        startup: function () {
            this.inherited("startup", arguments);
            this._tabsDijit.watch("selectedChildWidget", lang.hitch(this, function (name, oval, nval) {
                if (nval === this._itemEditorTab) {
                    if (oval !== this._choicesTab) {
//TODO fix
//                        this.item._source = json.parse(attr.get(this._contentsNode, "value"));
                    }
                    this._showEditor();
                } else if (nval === this._choicesTab) {
                    this._showChoices();
                } else {
                    this._showContent();
                }
            }));
            var readOnly = this.saveDisabled || array.every(this.itemStore.getBundles(), function(bundle) {
                return bundle.isReadOnly();
            })
            if (readOnly) {
                this._saveAllButton.set("disabled", true);
            }
        },
        resize: function () {
            this.inherited("resize", arguments);
            if (this._bcDijit) {
                this._bcDijit.resize();
            }
        },
        itemChanged: function() {
            this.tree.get("model").onChange(this.item);
            this._showContent();
        },
        //===================================================
        // Private methods
        //===================================================

        _buildTree: function () {
            var root = this.itemStore;
            var model = new ItemTreeModel(root);

            var itemAcceptance = function(node,source,position) {
                var tn = registry.getEnclosingWidget(node);
                var sourceTn = source.getSelectedTreeNodes()[0];
                if (tn.item === root) {
                    return false;
                }

                var item = sourceTn.item;
                var oldParentItem = sourceTn.getParent().item;
                var newParentItem = position === "over" ? tn.item: tn.getParent().item;
                if (!(newParentItem instanceof Group || newParentItem instanceof Bundle)) {
                    return false;
                }
                return model.getPasteAction(item, oldParentItem, newParentItem)[0] !== "N";
            };

            this.tree = new Tree({
                showRoot: false,
                model: model,
                dndController: TreeDndSource,
                checkItemAcceptance: itemAcceptance,
                betweenThreshold: 5,
                getRowClass: function(item) {
                    if (item === root) {
                        return "readOnly";
                    } else {
                        var bundle = item instanceof Bundle ? item : item.getBundle();
                        return bundle.isReadOnly() ? "readOnly": "editable";
                    }
                },
                getIconClass: function(/*dojo.store.Item*/ item, /*Boolean*/ opened){
                    return (!item || this.model.mayHaveChildren(item)) ? (opened ? "dijitFolderOpened" : "dijitFolderClosed") :
                        item instanceof Choice ? "dijitIconConnector" : "dijitLeaf";
                },
                onClick: lang.hitch(this, function (item) {
                    if (this._editor != null) {
                        this._editor.destroy();
                    }
                    this.item = item;
                    this._showEditor();
                    this._showContent();
                    this._showChoices();
                })
            }, construct.create("div", null, this._treeNode));
            this.tree.startup();
            if (this.menu) {
                this.menu.destroy();
            }
            this.menu = new Menu({
                targetNodeIds: [this.tree.id],
                selector: ".dijitTreeNode"
            });
            var addItem = lang.hitch(this, function(tn, source) {
                var bundle = tn.item instanceof Bundle ? tn.item : tn.item.getBundle();
                if (bundle.isReadOnly()) {
                    alert("Cannot perform operation on read-only item.");
                    return;
                }
                var clone = source == null;
                if (clone) {
                    source = lang.clone(tn.item.getSource(true));
                    delete source.id;
                }
                if (tn.item === root || tn.item instanceof Bundle) {
                    source.id = ""+new Date().getTime();
                    this.__newItem(source, tn.item);
                    return;
                }
                if (tn.getParent().item instanceof Bundle && !(tn.item instanceof Group)) {
                    source.id = ""+new Date().getTime();
                    this.__newItem(source, tn.getParent().item);
                    return;
                }

                if (tn.item instanceof Group && !clone) {
                    this.__newItem(source, tn.item);
                } else {
                    var parent = tn.getParent().item;
                    this.__newItem(source, parent, parent.getChildren().indexOf(tn.item)+1);
                }
            });
            this.menu.addChild(new MenuItem({
                label: "New TextItem",
                iconClass: "dijitIconFile",
                onClick: function() {
                    addItem(registry.byNode(this.getParent().currentTarget), {type: "text", nodetype: "LITERAL"});
                }
            }));
            this.menu.addChild(new MenuItem({
                label: "New ChoiceItem",
                iconClass: "dijitIconConnector",
                onClick: function() {
                    addItem(registry.byNode(this.getParent().currentTarget), {type: "choice", nodetype: "URI"});
                }
            }));
            this.menu.addChild(new MenuItem({
                label: "New GroupItem",
                iconClass: "dijitFolderOpened",
                onClick: function() {
                    addItem(registry.byNode(this.getParent().currentTarget), {type: "group", nodetype: "RESOURCE"});
                }
            }));
            this.menu.addChild(new MenuItem({
                label: "Clone Item",
                iconClass: "dijitFolderOpened",
                onClick: function() {
                    addItem(registry.byNode(this.getParent().currentTarget));
                }
            }));
            this.menu.addChild(new MenuSeparator());
            var removeItem = lang.hitch(this, function(tn) {
                if (tn.item === root || tn.item instanceof Bundle) {
                    alert("Cannot remove root or bundles!");
                } else if (tn.getParent().item instanceof Bundle) {
                    if (tn.item.getBundle().isReadOnly()) {
                        alert("Cannot remove read-only items.");
                        return;
                    }
                    this.tree.get("model").removeItem(tn.item, tn.getParent().item);
                    this.itemStore.removeItem(tn.item);
                } else {
                    if (tn.getParent().item.getBundle().isReadOnly()) {
                        alert("Cannot remove read-only items.");
                        return;
                    }
                    this.tree.get("model").removeItem(tn.item, tn.getParent().item);
                }
            });
            this.menu.addChild(new MenuItem({
                label: "Remove item",
                iconClass: "dijitEditorIcon dijitEditorIconDelete",
                onClick: function() {
                    removeItem(registry.byNode(this.getParent().currentTarget));
                }
            }));

            this.menu.startup();
        },
        _saveTemplates: function () {
            array.forEach(this.itemStore.getBundles(), function(bundle) {
                if (!bundle.isReadOnly()) {
                    xhr.put(bundle.getPath(), {data: json.stringify(bundle.getSource(), true, "  "), headers: {"content-type": "application/json"}});
                }
            });
        },

        _showEditor: function () {
            if (this._editor != null) {
                this._editor.destroy();
            }
            if (this.item != null && !(this.item instanceof Bundle)) {
                this._editor = new ItemEditor({item: this.item, itemStore: this.itemStore, storeManager: this}, construct.create("div", null, this._editorNode));
            }
        },
        __newItem: function(source, parent, insertIndex) {
            var newItem;
            if (parent === this.itemStore || parent == null) {
                parent = this.itemStore;
                newItem = this.itemStore.createItem(source, false, false, this.itemStore.getBundles()[0]); //Register mew item since it is not inline.
            } else if (parent instanceof Bundle) {
                newItem = this.itemStore.createItem(source, false, false, parent); //Register mew item since it is not inline.
            } else {
                newItem = this.itemStore.createItem(source, false, true, parent.getBundle()); //Do not clone, but skip registration since item is inline.
            }
            this.tree.get("model").newItem(newItem, parent, insertIndex);
            var tn = this.tree.getNodesByItem(newItem)[0];
            tn.getParent().expand();
            this.tree.focusNode(tn);
            this.tree.set("selectedItem", newItem);
            this.item = newItem;
            this._showEditor();
            this._showContent();
            this._showChoices();
        },
        _showContent: function () {
            attr.set(this._contentsNode, "value", json.stringify(this.item.getSource(true), true, "  "));
            if (this._editorDijit != null) {
                this._editorDijit.destroy();
            }
            if (this.item instanceof Bundle) {
                return;
            }
            var template;
            if (this.item.getChildren) {
                template = this.item;
            } else {
                template = this.itemStore.createTemplateFromChildren([this.item]);
            }
            this._editorDijit = new Experiment({gutters: false, hideTemplate: true, template: template, graphObj: this.data}, construct.create("div", null, this._previewNode));
            this._editorDijit.startup();
            this._bcDijit.resize();
        },
        _showChoices: function() {
            if (this._choicesEditor) {
                this._choicesEditor.destroy();
            }
            if (this.item instanceof Choice) {
                this._choicesEditor = new ChoicesEditor({item: this.item}, construct.create("div", null, this._choicesNode));
                this._choicesEditor.onChange = lang.hitch(this, this._showContent);
                this._choicesEditor.startup();
                this._choicesEditor.resize();
            }
        },
        _showAll: function () {
            var arr = [];
            array.forEach(this.itemStore.getItems(), function (item) {
                arr.push(item.getSource(true));
            }, this);

            var str = json.stringify(arr, true, "  ");
            attr.set(this._contentsNode, "value", str);
            if (this._editorDijit != null) {
                this._editorDijit.destroy();
            }
        }
    });
});
},
'dojo/dnd/Source':function(){
define([
	"../_base/array", "../_base/declare", "../_base/kernel", "../_base/lang",
	"../dom-class", "../dom-geometry", "../mouse", "../ready", "../topic",
	"./common", "./Selector", "./Manager"
], function(array, declare, kernel, lang, domClass, domGeom, mouse, ready, topic,
			dnd, Selector, Manager){

// module:
//		dojo/dnd/Source

/*
	Container property:
		"Horizontal"- if this is the horizontal container
	Source states:
		""			- normal state
		"Moved"		- this source is being moved
		"Copied"	- this source is being copied
	Target states:
		""			- normal state
		"Disabled"	- the target cannot accept an avatar
	Target anchor state:
		""			- item is not selected
		"Before"	- insert point is before the anchor
		"After"		- insert point is after the anchor
*/

/*=====
var __SourceArgs = {
	// summary:
	//		a dict of parameters for DnD Source configuration. Note that any
	//		property on Source elements may be configured, but this is the
	//		short-list
	// isSource: Boolean?
	//		can be used as a DnD source. Defaults to true.
	// accept: Array?
	//		list of accepted types (text strings) for a target; defaults to
	//		["text"]
	// autoSync: Boolean
	//		if true refreshes the node list on every operation; false by default
	// copyOnly: Boolean?
	//		copy items, if true, use a state of Ctrl key otherwise,
	//		see selfCopy and selfAccept for more details
	// delay: Number
	//		the move delay in pixels before detecting a drag; 0 by default
	// horizontal: Boolean?
	//		a horizontal container, if true, vertical otherwise or when omitted
	// selfCopy: Boolean?
	//		copy items by default when dropping on itself,
	//		false by default, works only if copyOnly is true
	// selfAccept: Boolean?
	//		accept its own items when copyOnly is true,
	//		true by default, works only if copyOnly is true
	// withHandles: Boolean?
	//		allows dragging only by handles, false by default
	// generateText: Boolean?
	//		generate text node for drag and drop, true by default
};
=====*/

// For back-compat, remove in 2.0.
if(!kernel.isAsync){
	ready(0, function(){
		var requires = ["dojo/dnd/AutoSource", "dojo/dnd/Target"];
		require(requires);	// use indirection so modules not rolled into a build
	});
}

var Source = declare("dojo.dnd.Source", Selector, {
	// summary:
	//		a Source object, which can be used as a DnD source, or a DnD target

	// object attributes (for markup)
	isSource: true,
	horizontal: false,
	copyOnly: false,
	selfCopy: false,
	selfAccept: true,
	skipForm: false,
	withHandles: false,
	autoSync: false,
	delay: 0, // pixels
	accept: ["text"],
	generateText: true,

	constructor: function(/*DOMNode|String*/ node, /*__SourceArgs?*/ params){
		// summary:
		//		a constructor of the Source
		// node:
		//		node or node's id to build the source on
		// params:
		//		any property of this class may be configured via the params
		//		object which is mixed-in to the `dojo/dnd/Source` instance
		lang.mixin(this, lang.mixin({}, params));
		var type = this.accept;
		if(type.length){
			this.accept = {};
			for(var i = 0; i < type.length; ++i){
				this.accept[type[i]] = 1;
			}
		}
		// class-specific variables
		this.isDragging = false;
		this.mouseDown = false;
		this.targetAnchor = null;
		this.targetBox = null;
		this.before = true;
		this._lastX = 0;
		this._lastY = 0;
		// states
		this.sourceState  = "";
		if(this.isSource){
			domClass.add(this.node, "dojoDndSource");
		}
		this.targetState  = "";
		if(this.accept){
			domClass.add(this.node, "dojoDndTarget");
		}
		if(this.horizontal){
			domClass.add(this.node, "dojoDndHorizontal");
		}
		// set up events
		this.topics = [
			topic.subscribe("/dnd/source/over", lang.hitch(this, "onDndSourceOver")),
			topic.subscribe("/dnd/start",  lang.hitch(this, "onDndStart")),
			topic.subscribe("/dnd/drop",   lang.hitch(this, "onDndDrop")),
			topic.subscribe("/dnd/cancel", lang.hitch(this, "onDndCancel"))
		];
	},

	// methods
	checkAcceptance: function(source, nodes){
		// summary:
		//		checks if the target can accept nodes from this source
		// source: Object
		//		the source which provides items
		// nodes: Array
		//		the list of transferred items
		if(this == source){
			return !this.copyOnly || this.selfAccept;
		}
		for(var i = 0; i < nodes.length; ++i){
			var type = source.getItem(nodes[i].id).type;
			// type instanceof Array
			var flag = false;
			for(var j = 0; j < type.length; ++j){
				if(type[j] in this.accept){
					flag = true;
					break;
				}
			}
			if(!flag){
				return false;	// Boolean
			}
		}
		return true;	// Boolean
	},
	copyState: function(keyPressed, self){
		// summary:
		//		Returns true if we need to copy items, false to move.
		//		It is separated to be overwritten dynamically, if needed.
		// keyPressed: Boolean
		//		the "copy" key was pressed
		// self: Boolean?
		//		optional flag that means that we are about to drop on itself

		if(keyPressed){ return true; }
		if(arguments.length < 2){
			self = this == Manager.manager().target;
		}
		if(self){
			if(this.copyOnly){
				return this.selfCopy;
			}
		}else{
			return this.copyOnly;
		}
		return false;	// Boolean
	},
	destroy: function(){
		// summary:
		//		prepares the object to be garbage-collected
		Source.superclass.destroy.call(this);
		array.forEach(this.topics, function(t){t.remove();});
		this.targetAnchor = null;
	},

	// mouse event processors
	onMouseMove: function(e){
		// summary:
		//		event processor for onmousemove
		// e: Event
		//		mouse event
		if(this.isDragging && this.targetState == "Disabled"){ return; }
		Source.superclass.onMouseMove.call(this, e);
		var m = Manager.manager();
		if(!this.isDragging){
			if(this.mouseDown && this.isSource &&
					(Math.abs(e.pageX - this._lastX) > this.delay || Math.abs(e.pageY - this._lastY) > this.delay)){
				var nodes = this.getSelectedNodes();
				if(nodes.length){
					m.startDrag(this, nodes, this.copyState(dnd.getCopyKeyState(e), true));
				}
			}
		}
		if(this.isDragging){
			// calculate before/after
			var before = false;
			if(this.current){
				if(!this.targetBox || this.targetAnchor != this.current){
					this.targetBox = domGeom.position(this.current, true);
				}
				if(this.horizontal){
					// In LTR mode, the left part of the object means "before", but in RTL mode it means "after".
					before = (e.pageX - this.targetBox.x < this.targetBox.w / 2) == domGeom.isBodyLtr(this.current.ownerDocument);
				}else{
					before = (e.pageY - this.targetBox.y) < (this.targetBox.h / 2);
				}
			}
			if(this.current != this.targetAnchor || before != this.before){
				this._markTargetAnchor(before);
				m.canDrop(!this.current || m.source != this || !(this.current.id in this.selection));
			}
		}
	},
	onMouseDown: function(e){
		// summary:
		//		event processor for onmousedown
		// e: Event
		//		mouse event
		if(!this.mouseDown && this._legalMouseDown(e) && (!this.skipForm || !dnd.isFormElement(e))){
			this.mouseDown = true;
			this._lastX = e.pageX;
			this._lastY = e.pageY;
			Source.superclass.onMouseDown.call(this, e);
		}
	},
	onMouseUp: function(e){
		// summary:
		//		event processor for onmouseup
		// e: Event
		//		mouse event
		if(this.mouseDown){
			this.mouseDown = false;
			Source.superclass.onMouseUp.call(this, e);
		}
	},

	// topic event processors
	onDndSourceOver: function(source){
		// summary:
		//		topic event processor for /dnd/source/over, called when detected a current source
		// source: Object
		//		the source which has the mouse over it
		if(this !== source){
			this.mouseDown = false;
			if(this.targetAnchor){
				this._unmarkTargetAnchor();
			}
		}else if(this.isDragging){
			var m = Manager.manager();
			m.canDrop(this.targetState != "Disabled" && (!this.current || m.source != this || !(this.current.id in this.selection)));
		}
	},
	onDndStart: function(source, nodes, copy){
		// summary:
		//		topic event processor for /dnd/start, called to initiate the DnD operation
		// source: Object
		//		the source which provides items
		// nodes: Array
		//		the list of transferred items
		// copy: Boolean
		//		copy items, if true, move items otherwise
		if(this.autoSync){ this.sync(); }
		if(this.isSource){
			this._changeState("Source", this == source ? (copy ? "Copied" : "Moved") : "");
		}
		var accepted = this.accept && this.checkAcceptance(source, nodes);
		this._changeState("Target", accepted ? "" : "Disabled");
		if(this == source){
			Manager.manager().overSource(this);
		}
		this.isDragging = true;
	},
	onDndDrop: function(source, nodes, copy, target){
		// summary:
		//		topic event processor for /dnd/drop, called to finish the DnD operation
		// source: Object
		//		the source which provides items
		// nodes: Array
		//		the list of transferred items
		// copy: Boolean
		//		copy items, if true, move items otherwise
		// target: Object
		//		the target which accepts items
		if(this == target){
			// this one is for us => move nodes!
			this.onDrop(source, nodes, copy);
		}
		this.onDndCancel();
	},
	onDndCancel: function(){
		// summary:
		//		topic event processor for /dnd/cancel, called to cancel the DnD operation
		if(this.targetAnchor){
			this._unmarkTargetAnchor();
			this.targetAnchor = null;
		}
		this.before = true;
		this.isDragging = false;
		this.mouseDown = false;
		this._changeState("Source", "");
		this._changeState("Target", "");
	},

	// local events
	onDrop: function(source, nodes, copy){
		// summary:
		//		called only on the current target, when drop is performed
		// source: Object
		//		the source which provides items
		// nodes: Array
		//		the list of transferred items
		// copy: Boolean
		//		copy items, if true, move items otherwise

		if(this != source){
			this.onDropExternal(source, nodes, copy);
		}else{
			this.onDropInternal(nodes, copy);
		}
	},
	onDropExternal: function(source, nodes, copy){
		// summary:
		//		called only on the current target, when drop is performed
		//		from an external source
		// source: Object
		//		the source which provides items
		// nodes: Array
		//		the list of transferred items
		// copy: Boolean
		//		copy items, if true, move items otherwise

		var oldCreator = this._normalizedCreator;
		// transferring nodes from the source to the target
		if(this.creator){
			// use defined creator
			this._normalizedCreator = function(node, hint){
				return oldCreator.call(this, source.getItem(node.id).data, hint);
			};
		}else{
			// we have no creator defined => move/clone nodes
			if(copy){
				// clone nodes
				this._normalizedCreator = function(node /*=====, hint =====*/){
					var t = source.getItem(node.id);
					var n = node.cloneNode(true);
					n.id = dnd.getUniqueId();
					return {node: n, data: t.data, type: t.type};
				};
			}else{
				// move nodes
				this._normalizedCreator = function(node /*=====, hint =====*/){
					var t = source.getItem(node.id);
					source.delItem(node.id);
					return {node: node, data: t.data, type: t.type};
				};
			}
		}
		this.selectNone();
		if(!copy && !this.creator){
			source.selectNone();
		}
		this.insertNodes(true, nodes, this.before, this.current);
		if(!copy && this.creator){
			source.deleteSelectedNodes();
		}
		this._normalizedCreator = oldCreator;
	},
	onDropInternal: function(nodes, copy){
		// summary:
		//		called only on the current target, when drop is performed
		//		from the same target/source
		// nodes: Array
		//		the list of transferred items
		// copy: Boolean
		//		copy items, if true, move items otherwise

		var oldCreator = this._normalizedCreator;
		// transferring nodes within the single source
		if(this.current && this.current.id in this.selection){
			// do nothing
			return;
		}
		if(copy){
			if(this.creator){
				// create new copies of data items
				this._normalizedCreator = function(node, hint){
					return oldCreator.call(this, this.getItem(node.id).data, hint);
				};
			}else{
				// clone nodes
				this._normalizedCreator = function(node/*=====, hint =====*/){
					var t = this.getItem(node.id);
					var n = node.cloneNode(true);
					n.id = dnd.getUniqueId();
					return {node: n, data: t.data, type: t.type};
				};
			}
		}else{
			// move nodes
			if(!this.current){
				// do nothing
				return;
			}
			this._normalizedCreator = function(node /*=====, hint =====*/){
				var t = this.getItem(node.id);
				return {node: node, data: t.data, type: t.type};
			};
		}
		this._removeSelection();
		this.insertNodes(true, nodes, this.before, this.current);
		this._normalizedCreator = oldCreator;
	},
	onDraggingOver: function(){
		// summary:
		//		called during the active DnD operation, when items
		//		are dragged over this target, and it is not disabled
	},
	onDraggingOut: function(){
		// summary:
		//		called during the active DnD operation, when items
		//		are dragged away from this target, and it is not disabled
	},

	// utilities
	onOverEvent: function(){
		// summary:
		//		this function is called once, when mouse is over our container
		Source.superclass.onOverEvent.call(this);
		Manager.manager().overSource(this);
		if(this.isDragging && this.targetState != "Disabled"){
			this.onDraggingOver();
		}
	},
	onOutEvent: function(){
		// summary:
		//		this function is called once, when mouse is out of our container
		Source.superclass.onOutEvent.call(this);
		Manager.manager().outSource(this);
		if(this.isDragging && this.targetState != "Disabled"){
			this.onDraggingOut();
		}
	},
	_markTargetAnchor: function(before){
		// summary:
		//		assigns a class to the current target anchor based on "before" status
		// before: Boolean
		//		insert before, if true, after otherwise
		if(this.current == this.targetAnchor && this.before == before){ return; }
		if(this.targetAnchor){
			this._removeItemClass(this.targetAnchor, this.before ? "Before" : "After");
		}
		this.targetAnchor = this.current;
		this.targetBox = null;
		this.before = before;
		if(this.targetAnchor){
			this._addItemClass(this.targetAnchor, this.before ? "Before" : "After");
		}
	},
	_unmarkTargetAnchor: function(){
		// summary:
		//		removes a class of the current target anchor based on "before" status
		if(!this.targetAnchor){ return; }
		this._removeItemClass(this.targetAnchor, this.before ? "Before" : "After");
		this.targetAnchor = null;
		this.targetBox = null;
		this.before = true;
	},
	_markDndStatus: function(copy){
		// summary:
		//		changes source's state based on "copy" status
		this._changeState("Source", copy ? "Copied" : "Moved");
	},
	_legalMouseDown: function(e){
		// summary:
		//		checks if user clicked on "approved" items
		// e: Event
		//		mouse event

		// accept only the left mouse button, or the left finger
		if(e.type != "touchstart" && !mouse.isLeft(e)){ return false; }

		if(!this.withHandles){ return true; }

		// check for handles
		for(var node = e.target; node && node !== this.node; node = node.parentNode){
			if(domClass.contains(node, "dojoDndHandle")){ return true; }
			if(domClass.contains(node, "dojoDndItem") || domClass.contains(node, "dojoDndIgnore")){ break; }
		}
		return false;	// Boolean
	}
});

return Source;

});

},
'dojo/dnd/Selector':function(){
define([
	"../_base/array", "../_base/declare", "../_base/kernel", "../_base/lang",
	"../dom", "../dom-construct", "../mouse", "../_base/NodeList", "../on", "../touch", "./common", "./Container"
], function(array, declare, kernel, lang, dom, domConstruct, mouse, NodeList, on, touch, dnd, Container){

// module:
//		dojo/dnd/Selector

/*
	Container item states:
		""			- an item is not selected
		"Selected"	- an item is selected
		"Anchor"	- an item is selected, and is an anchor for a "shift" selection
*/

/*=====
var __SelectorArgs = declare([Container.__ContainerArgs], {
	// singular: Boolean
	//		allows selection of only one element, if true
	singular: false,

	// autoSync: Boolean
	//		autosynchronizes the source with its list of DnD nodes,
	autoSync: false
});
=====*/

var Selector = declare("dojo.dnd.Selector", Container, {
	// summary:
	//		a Selector object, which knows how to select its children

	/*=====
	// selection: Set<String>
	//		The set of id's that are currently selected, such that this.selection[id] == 1
	//		if the node w/that id is selected.  Can iterate over selected node's id's like:
	//	|		for(var id in this.selection)
	selection: {},
	=====*/

	constructor: function(node, params){
		// summary:
		//		constructor of the Selector
		// node: Node||String
		//		node or node's id to build the selector on
		// params: __SelectorArgs?
		//		a dictionary of parameters
		if(!params){ params = {}; }
		this.singular = params.singular;
		this.autoSync = params.autoSync;
		// class-specific variables
		this.selection = {};
		this.anchor = null;
		this.simpleSelection = false;
		// set up events
		this.events.push(
			on(this.node, touch.press, lang.hitch(this, "onMouseDown")),
			on(this.node, touch.release, lang.hitch(this, "onMouseUp"))
		);
	},

	// object attributes (for markup)
	singular: false,	// is singular property

	// methods
	getSelectedNodes: function(){
		// summary:
		//		returns a list (an array) of selected nodes
		var t = new NodeList();
		var e = dnd._empty;
		for(var i in this.selection){
			if(i in e){ continue; }
			t.push(dom.byId(i));
		}
		return t;	// NodeList
	},
	selectNone: function(){
		// summary:
		//		unselects all items
		return this._removeSelection()._removeAnchor();	// self
	},
	selectAll: function(){
		// summary:
		//		selects all items
		this.forInItems(function(data, id){
			this._addItemClass(dom.byId(id), "Selected");
			this.selection[id] = 1;
		}, this);
		return this._removeAnchor();	// self
	},
	deleteSelectedNodes: function(){
		// summary:
		//		deletes all selected items
		var e = dnd._empty;
		for(var i in this.selection){
			if(i in e){ continue; }
			var n = dom.byId(i);
			this.delItem(i);
			domConstruct.destroy(n);
		}
		this.anchor = null;
		this.selection = {};
		return this;	// self
	},
	forInSelectedItems: function(/*Function*/ f, /*Object?*/ o){
		// summary:
		//		iterates over selected items;
		//		see `dojo/dnd/Container.forInItems()` for details
		o = o || kernel.global;
		var s = this.selection, e = dnd._empty;
		for(var i in s){
			if(i in e){ continue; }
			f.call(o, this.getItem(i), i, this);
		}
	},
	sync: function(){
		// summary:
		//		sync up the node list with the data map

		Selector.superclass.sync.call(this);

		// fix the anchor
		if(this.anchor){
			if(!this.getItem(this.anchor.id)){
				this.anchor = null;
			}
		}

		// fix the selection
		var t = [], e = dnd._empty;
		for(var i in this.selection){
			if(i in e){ continue; }
			if(!this.getItem(i)){
				t.push(i);
			}
		}
		array.forEach(t, function(i){
			delete this.selection[i];
		}, this);

		return this;	// self
	},
	insertNodes: function(addSelected, data, before, anchor){
		// summary:
		//		inserts new data items (see `dojo/dnd/Container.insertNodes()` method for details)
		// addSelected: Boolean
		//		all new nodes will be added to selected items, if true, no selection change otherwise
		// data: Array
		//		a list of data items, which should be processed by the creator function
		// before: Boolean
		//		insert before the anchor, if true, and after the anchor otherwise
		// anchor: Node
		//		the anchor node to be used as a point of insertion
		var oldCreator = this._normalizedCreator;
		this._normalizedCreator = function(item, hint){
			var t = oldCreator.call(this, item, hint);
			if(addSelected){
				if(!this.anchor){
					this.anchor = t.node;
					this._removeItemClass(t.node, "Selected");
					this._addItemClass(this.anchor, "Anchor");
				}else if(this.anchor != t.node){
					this._removeItemClass(t.node, "Anchor");
					this._addItemClass(t.node, "Selected");
				}
				this.selection[t.node.id] = 1;
			}else{
				this._removeItemClass(t.node, "Selected");
				this._removeItemClass(t.node, "Anchor");
			}
			return t;
		};
		Selector.superclass.insertNodes.call(this, data, before, anchor);
		this._normalizedCreator = oldCreator;
		return this;	// self
	},
	destroy: function(){
		// summary:
		//		prepares the object to be garbage-collected
		Selector.superclass.destroy.call(this);
		this.selection = this.anchor = null;
	},

	// mouse events
	onMouseDown: function(e){
		// summary:
		//		event processor for onmousedown
		// e: Event
		//		mouse event
		if(this.autoSync){ this.sync(); }
		if(!this.current){ return; }
		if(!this.singular && !dnd.getCopyKeyState(e) && !e.shiftKey && (this.current.id in this.selection)){
			this.simpleSelection = true;
			if(mouse.isLeft(e)){
				// Accept the left button and stop the event.   Stopping the event prevents text selection while
				// dragging.   However, don't stop the event on mobile because that prevents a click event,
				// and also prevents scroll (see #15838).
				// For IE we don't stop event when multiple buttons are pressed.
				e.stopPropagation();
				e.preventDefault();
			}
			return;
		}
		if(!this.singular && e.shiftKey){
			if(!dnd.getCopyKeyState(e)){
				this._removeSelection();
			}
			var c = this.getAllNodes();
			if(c.length){
				if(!this.anchor){
					this.anchor = c[0];
					this._addItemClass(this.anchor, "Anchor");
				}
				this.selection[this.anchor.id] = 1;
				if(this.anchor != this.current){
					var i = 0, node;
					for(; i < c.length; ++i){
						node = c[i];
						if(node == this.anchor || node == this.current){ break; }
					}
					for(++i; i < c.length; ++i){
						node = c[i];
						if(node == this.anchor || node == this.current){ break; }
						this._addItemClass(node, "Selected");
						this.selection[node.id] = 1;
					}
					this._addItemClass(this.current, "Selected");
					this.selection[this.current.id] = 1;
				}
			}
		}else{
			if(this.singular){
				if(this.anchor == this.current){
					if(dnd.getCopyKeyState(e)){
						this.selectNone();
					}
				}else{
					this.selectNone();
					this.anchor = this.current;
					this._addItemClass(this.anchor, "Anchor");
					this.selection[this.current.id] = 1;
				}
			}else{
				if(dnd.getCopyKeyState(e)){
					if(this.anchor == this.current){
						delete this.selection[this.anchor.id];
						this._removeAnchor();
					}else{
						if(this.current.id in this.selection){
							this._removeItemClass(this.current, "Selected");
							delete this.selection[this.current.id];
						}else{
							if(this.anchor){
								this._removeItemClass(this.anchor, "Anchor");
								this._addItemClass(this.anchor, "Selected");
							}
							this.anchor = this.current;
							this._addItemClass(this.current, "Anchor");
							this.selection[this.current.id] = 1;
						}
					}
				}else{
					if(!(this.current.id in this.selection)){
						this.selectNone();
						this.anchor = this.current;
						this._addItemClass(this.current, "Anchor");
						this.selection[this.current.id] = 1;
					}
				}
			}
		}
		e.stopPropagation();
		e.preventDefault();
	},
	onMouseUp: function(/*===== e =====*/){
		// summary:
		//		event processor for onmouseup
		// e: Event
		//		mouse event
		if(!this.simpleSelection){ return; }
		this.simpleSelection = false;
		this.selectNone();
		if(this.current){
			this.anchor = this.current;
			this._addItemClass(this.anchor, "Anchor");
			this.selection[this.current.id] = 1;
		}
	},
	onMouseMove: function(/*===== e =====*/){
		// summary:
		//		event processor for onmousemove
		// e: Event
		//		mouse event
		this.simpleSelection = false;
	},

	// utilities
	onOverEvent: function(){
		// summary:
		//		this function is called once, when mouse is over our container
		this.onmousemoveEvent = on(this.node, touch.move, lang.hitch(this, "onMouseMove"));
	},
	onOutEvent: function(){
		// summary:
		//		this function is called once, when mouse is out of our container
		if(this.onmousemoveEvent){
			this.onmousemoveEvent.remove();
			delete this.onmousemoveEvent;
		}
	},
	_removeSelection: function(){
		// summary:
		//		unselects all items
		var e = dnd._empty;
		for(var i in this.selection){
			if(i in e){ continue; }
			var node = dom.byId(i);
			if(node){ this._removeItemClass(node, "Selected"); }
		}
		this.selection = {};
		return this;	// self
	},
	_removeAnchor: function(){
		if(this.anchor){
			this._removeItemClass(this.anchor, "Anchor");
			this.anchor = null;
		}
		return this;	// self
	}
});

return Selector;

});

},
'dojo/_base/NodeList':function(){
define(["./kernel", "../query", "./array", "./html", "../NodeList-dom"], function(dojo, query, array){
	// module:
	//		dojo/_base/NodeList

	/*=====
	return {
		// summary:
		//		This module extends dojo/NodeList with the legacy connect(), coords(),
		//		blur(), focus(), change(), click(), error(), keydown(), keypress(),
		//		keyup(), load(), mousedown(), mouseenter(), mouseleave(), mousemove(),
		//		mouseout(), mouseover(), mouseup(), and submit() methods.
	};
	=====*/
 
	var NodeList = query.NodeList,
		nlp = NodeList.prototype;

	nlp.connect = NodeList._adaptAsForEach(function(){
		// don't bind early to dojo.connect since we no longer explicitly depend on it
		return dojo.connect.apply(this, arguments);
	});
	/*=====
	nlp.connect = function(methodName, objOrFunc, funcName){
		// summary:
		//		Attach event handlers to every item of the NodeList. Uses dojo.connect()
		//		so event properties are normalized.
		//
		//		Application must manually require() "dojo/_base/connect" before using this method.
		// methodName: String
		//		the name of the method to attach to. For DOM events, this should be
		//		the lower-case name of the event
		// objOrFunc: Object|Function|String
		//		if 2 arguments are passed (methodName, objOrFunc), objOrFunc should
		//		reference a function or be the name of the function in the global
		//		namespace to attach. If 3 arguments are provided
		//		(methodName, objOrFunc, funcName), objOrFunc must be the scope to
		//		locate the bound function in
		// funcName: String?
		//		optional. A string naming the function in objOrFunc to bind to the
		//		event. May also be a function reference.
		// example:
		//		add an onclick handler to every button on the page
		//		|	query("div:nth-child(odd)").connect("onclick", function(e){
		//		|		console.log("clicked!");
		//		|	});
		// example:
		//		attach foo.bar() to every odd div's onmouseover
		//		|	query("div:nth-child(odd)").connect("onmouseover", foo, "bar");

		return null;	// NodeList
	};
	=====*/

	nlp.coords = NodeList._adaptAsMap(dojo.coords);
	/*=====
	nlp.coords = function(){
		// summary:
		//		Deprecated: Use position() for border-box x/y/w/h
		//		or marginBox() for margin-box w/h/l/t.
		//		Returns the box objects of all elements in a node list as
		//		an Array (*not* a NodeList). Acts like `domGeom.coords`, though assumes
		//		the node passed is each node in this list.

		return []; // Array
	};
	=====*/

	NodeList.events = [
		// summary:
		//		list of all DOM events used in NodeList
		"blur", "focus", "change", "click", "error", "keydown", "keypress",
		"keyup", "load", "mousedown", "mouseenter", "mouseleave", "mousemove",
		"mouseout", "mouseover", "mouseup", "submit"
	];

	// FIXME: pseudo-doc the above automatically generated on-event functions

	// syntactic sugar for DOM events
	array.forEach(NodeList.events, function(evt){
			var _oe = "on" + evt;
			nlp[_oe] = function(a, b){
				return this.connect(_oe, a, b);
			};
				// FIXME: should these events trigger publishes?
				/*
				return (a ? this.connect(_oe, a, b) :
							this.forEach(function(n){
								// FIXME:
								//		listeners get buried by
								//		addEventListener and can't be dug back
								//		out to be triggered externally.
								// see:
								//		http://developer.mozilla.org/en/docs/DOM:element

								console.log(n, evt, _oe);

								// FIXME: need synthetic event support!
								var _e = { target: n, faux: true, type: evt };
								// dojo._event_listener._synthesizeEvent({}, { target: n, faux: true, type: evt });
								try{ n[evt](_e); }catch(e){ console.log(e); }
								try{ n[_oe](_e); }catch(e){ console.log(e); }
							})
				);
				*/
		}
	);

	dojo.NodeList = NodeList;
	return NodeList;
});

},
'dojo/_base/html':function(){
define(["./kernel", "../dom", "../dom-style", "../dom-attr", "../dom-prop", "../dom-class", "../dom-construct", "../dom-geometry"], function(dojo, dom, style, attr, prop, cls, ctr, geom){
	// module:
	//		dojo/dom

	/*=====
	return {
		// summary:
		//		This module is a stub for the core dojo DOM API.
	};
	=====*/

	// mix-in dom
	dojo.byId = dom.byId;
	dojo.isDescendant = dom.isDescendant;
	dojo.setSelectable = dom.setSelectable;

	// mix-in dom-attr
	dojo.getAttr = attr.get;
	dojo.setAttr = attr.set;
	dojo.hasAttr = attr.has;
	dojo.removeAttr = attr.remove;
	dojo.getNodeProp = attr.getNodeProp;

	dojo.attr = function(node, name, value){
		// summary:
		//		Gets or sets an attribute on an HTML element.
		// description:
		//		Handles normalized getting and setting of attributes on DOM
		//		Nodes. If 2 arguments are passed, and a the second argument is a
		//		string, acts as a getter.
		//
		//		If a third argument is passed, or if the second argument is a
		//		map of attributes, acts as a setter.
		//
		//		When passing functions as values, note that they will not be
		//		directly assigned to slots on the node, but rather the default
		//		behavior will be removed and the new behavior will be added
		//		using `dojo.connect()`, meaning that event handler properties
		//		will be normalized and that some caveats with regards to
		//		non-standard behaviors for onsubmit apply. Namely that you
		//		should cancel form submission using `dojo.stopEvent()` on the
		//		passed event object instead of returning a boolean value from
		//		the handler itself.
		// node: DOMNode|String
		//		id or reference to the element to get or set the attribute on
		// name: String|Object
		//		the name of the attribute to get or set.
		// value: String?
		//		The value to set for the attribute
		// returns:
		//		when used as a getter, the value of the requested attribute
		//		or null if that attribute does not have a specified or
		//		default value;
		//
		//		when used as a setter, the DOM node
		//
		// example:
		//	|	// get the current value of the "foo" attribute on a node
		//	|	dojo.attr(dojo.byId("nodeId"), "foo");
		//	|	// or we can just pass the id:
		//	|	dojo.attr("nodeId", "foo");
		//
		// example:
		//	|	// use attr() to set the tab index
		//	|	dojo.attr("nodeId", "tabIndex", 3);
		//	|
		//
		// example:
		//	Set multiple values at once, including event handlers:
		//	|	dojo.attr("formId", {
		//	|		"foo": "bar",
		//	|		"tabIndex": -1,
		//	|		"method": "POST",
		//	|		"onsubmit": function(e){
		//	|			// stop submitting the form. Note that the IE behavior
		//	|			// of returning true or false will have no effect here
		//	|			// since our handler is connect()ed to the built-in
		//	|			// onsubmit behavior and so we need to use
		//	|			// dojo.stopEvent() to ensure that the submission
		//	|			// doesn't proceed.
		//	|			dojo.stopEvent(e);
		//	|
		//	|			// submit the form with Ajax
		//	|			dojo.xhrPost({ form: "formId" });
		//	|		}
		//	|	});
		//
		// example:
		//	Style is s special case: Only set with an object hash of styles
		//	|	dojo.attr("someNode",{
		//	|		id:"bar",
		//	|		style:{
		//	|			width:"200px", height:"100px", color:"#000"
		//	|		}
		//	|	});
		//
		// example:
		//	Again, only set style as an object hash of styles:
		//	|	var obj = { color:"#fff", backgroundColor:"#000" };
		//	|	dojo.attr("someNode", "style", obj);
		//	|
		//	|	// though shorter to use `dojo.style()` in this case:
		//	|	dojo.style("someNode", obj);

		if(arguments.length == 2){
			return attr[typeof name == "string" ? "get" : "set"](node, name);
		}
		return attr.set(node, name, value);
	};

	// mix-in dom-class
	dojo.hasClass = cls.contains;
	dojo.addClass = cls.add;
	dojo.removeClass = cls.remove;
	dojo.toggleClass = cls.toggle;
	dojo.replaceClass = cls.replace;

	// mix-in dom-construct
	dojo._toDom = dojo.toDom = ctr.toDom;
	dojo.place = ctr.place;
	dojo.create = ctr.create;
	dojo.empty = function(node){ ctr.empty(node); };
	dojo._destroyElement = dojo.destroy = function(node){ ctr.destroy(node); };

	// mix-in dom-geometry
	dojo._getPadExtents = dojo.getPadExtents = geom.getPadExtents;
	dojo._getBorderExtents = dojo.getBorderExtents = geom.getBorderExtents;
	dojo._getPadBorderExtents = dojo.getPadBorderExtents = geom.getPadBorderExtents;
	dojo._getMarginExtents = dojo.getMarginExtents = geom.getMarginExtents;
	dojo._getMarginSize = dojo.getMarginSize = geom.getMarginSize;
	dojo._getMarginBox = dojo.getMarginBox = geom.getMarginBox;
	dojo.setMarginBox = geom.setMarginBox;
	dojo._getContentBox = dojo.getContentBox = geom.getContentBox;
	dojo.setContentSize = geom.setContentSize;
	dojo._isBodyLtr = dojo.isBodyLtr = geom.isBodyLtr;
	dojo._docScroll = dojo.docScroll = geom.docScroll;
	dojo._getIeDocumentElementOffset = dojo.getIeDocumentElementOffset = geom.getIeDocumentElementOffset;
	dojo._fixIeBiDiScrollLeft = dojo.fixIeBiDiScrollLeft = geom.fixIeBiDiScrollLeft;
	dojo.position = geom.position;

	dojo.marginBox = function marginBox(/*DomNode|String*/node, /*Object?*/box){
		// summary:
		//		Getter/setter for the margin-box of node.
		// description:
		//		Getter/setter for the margin-box of node.
		//		Returns an object in the expected format of box (regardless
		//		if box is passed). The object might look like:
		//		`{ l: 50, t: 200, w: 300: h: 150 }`
		//		for a node offset from its parent 50px to the left, 200px from
		//		the top with a margin width of 300px and a margin-height of
		//		150px.
		// node:
		//		id or reference to DOM Node to get/set box for
		// box:
		//		If passed, denotes that dojo.marginBox() should
		//		update/set the margin box for node. Box is an object in the
		//		above format. All properties are optional if passed.
		// example:
		//		Retrieve the margin box of a passed node
		//	|	var box = dojo.marginBox("someNodeId");
		//	|	console.dir(box);
		//
		// example:
		//		Set a node's margin box to the size of another node
		//	|	var box = dojo.marginBox("someNodeId");
		//	|	dojo.marginBox("someOtherNode", box);
		return box ? geom.setMarginBox(node, box) : geom.getMarginBox(node); // Object
	};

	dojo.contentBox = function contentBox(/*DomNode|String*/node, /*Object?*/box){
		// summary:
		//		Getter/setter for the content-box of node.
		// description:
		//		Returns an object in the expected format of box (regardless if box is passed).
		//		The object might look like:
		//		`{ l: 50, t: 200, w: 300: h: 150 }`
		//		for a node offset from its parent 50px to the left, 200px from
		//		the top with a content width of 300px and a content-height of
		//		150px. Note that the content box may have a much larger border
		//		or margin box, depending on the box model currently in use and
		//		CSS values set/inherited for node.
		//		While the getter will return top and left values, the
		//		setter only accepts setting the width and height.
		// node:
		//		id or reference to DOM Node to get/set box for
		// box:
		//		If passed, denotes that dojo.contentBox() should
		//		update/set the content box for node. Box is an object in the
		//		above format, but only w (width) and h (height) are supported.
		//		All properties are optional if passed.
		return box ? geom.setContentSize(node, box) : geom.getContentBox(node); // Object
	};

	dojo.coords = function(/*DomNode|String*/node, /*Boolean?*/includeScroll){
		// summary:
		//		Deprecated: Use position() for border-box x/y/w/h
		//		or marginBox() for margin-box w/h/l/t.
		//
		//		Returns an object that measures margin-box (w)idth/(h)eight
		//		and absolute position x/y of the border-box. Also returned
		//		is computed (l)eft and (t)op values in pixels from the
		//		node's offsetParent as returned from marginBox().
		//		Return value will be in the form:
		//|			{ l: 50, t: 200, w: 300: h: 150, x: 100, y: 300 }
		//		Does not act as a setter. If includeScroll is passed, the x and
		//		y params are affected as one would expect in dojo.position().
		dojo.deprecated("dojo.coords()", "Use dojo.position() or dojo.marginBox().");
		node = dom.byId(node);
		var s = style.getComputedStyle(node), mb = geom.getMarginBox(node, s);
		var abs = geom.position(node, includeScroll);
		mb.x = abs.x;
		mb.y = abs.y;
		return mb;	// Object
	};

	// mix-in dom-prop
	dojo.getProp = prop.get;
	dojo.setProp = prop.set;

	dojo.prop = function(/*DomNode|String*/node, /*String|Object*/name, /*String?*/value){
		// summary:
		//		Gets or sets a property on an HTML element.
		// description:
		//		Handles normalized getting and setting of properties on DOM
		//		Nodes. If 2 arguments are passed, and a the second argument is a
		//		string, acts as a getter.
		//
		//		If a third argument is passed, or if the second argument is a
		//		map of attributes, acts as a setter.
		//
		//		When passing functions as values, note that they will not be
		//		directly assigned to slots on the node, but rather the default
		//		behavior will be removed and the new behavior will be added
		//		using `dojo.connect()`, meaning that event handler properties
		//		will be normalized and that some caveats with regards to
		//		non-standard behaviors for onsubmit apply. Namely that you
		//		should cancel form submission using `dojo.stopEvent()` on the
		//		passed event object instead of returning a boolean value from
		//		the handler itself.
		// node:
		//		id or reference to the element to get or set the property on
		// name:
		//		the name of the property to get or set.
		// value:
		//		The value to set for the property
		// returns:
		//		when used as a getter, the value of the requested property
		//		or null if that attribute does not have a specified or
		//		default value;
		//
		//		when used as a setter, the DOM node
		//
		// example:
		//	|	// get the current value of the "foo" property on a node
		//	|	dojo.prop(dojo.byId("nodeId"), "foo");
		//	|	// or we can just pass the id:
		//	|	dojo.prop("nodeId", "foo");
		//
		// example:
		//	|	// use prop() to set the tab index
		//	|	dojo.prop("nodeId", "tabIndex", 3);
		//	|
		//
		// example:
		//	Set multiple values at once, including event handlers:
		//	|	dojo.prop("formId", {
		//	|		"foo": "bar",
		//	|		"tabIndex": -1,
		//	|		"method": "POST",
		//	|		"onsubmit": function(e){
		//	|			// stop submitting the form. Note that the IE behavior
		//	|			// of returning true or false will have no effect here
		//	|			// since our handler is connect()ed to the built-in
		//	|			// onsubmit behavior and so we need to use
		//	|			// dojo.stopEvent() to ensure that the submission
		//	|			// doesn't proceed.
		//	|			dojo.stopEvent(e);
		//	|
		//	|			// submit the form with Ajax
		//	|			dojo.xhrPost({ form: "formId" });
		//	|		}
		//	|	});
		//
		// example:
		//		Style is s special case: Only set with an object hash of styles
		//	|	dojo.prop("someNode",{
		//	|		id:"bar",
		//	|		style:{
		//	|			width:"200px", height:"100px", color:"#000"
		//	|		}
		//	|	});
		//
		// example:
		//		Again, only set style as an object hash of styles:
		//	|	var obj = { color:"#fff", backgroundColor:"#000" };
		//	|	dojo.prop("someNode", "style", obj);
		//	|
		//	|	// though shorter to use `dojo.style()` in this case:
		//	|	dojo.style("someNode", obj);

		if(arguments.length == 2){
			return prop[typeof name == "string" ? "get" : "set"](node, name);
		}
		// setter
		return prop.set(node, name, value);
	};

	// mix-in dom-style
	dojo.getStyle = style.get;
	dojo.setStyle = style.set;
	dojo.getComputedStyle = style.getComputedStyle;
	dojo.__toPixelValue = dojo.toPixelValue = style.toPixelValue;

	dojo.style = function(node, name, value){
		// summary:
		//		Accesses styles on a node. If 2 arguments are
		//		passed, acts as a getter. If 3 arguments are passed, acts
		//		as a setter.
		// description:
		//		Getting the style value uses the computed style for the node, so the value
		//		will be a calculated value, not just the immediate node.style value.
		//		Also when getting values, use specific style names,
		//		like "borderBottomWidth" instead of "border" since compound values like
		//		"border" are not necessarily reflected as expected.
		//		If you want to get node dimensions, use `dojo.marginBox()`,
		//		`dojo.contentBox()` or `dojo.position()`.
		// node: DOMNode|String
		//		id or reference to node to get/set style for
		// name: String|Object?
		//		the style property to set in DOM-accessor format
		//		("borderWidth", not "border-width") or an object with key/value
		//		pairs suitable for setting each property.
		// value: String?
		//		If passed, sets value on the node for style, handling
		//		cross-browser concerns.  When setting a pixel value,
		//		be sure to include "px" in the value. For instance, top: "200px".
		//		Otherwise, in some cases, some browsers will not apply the style.
		// returns:
		//		when used as a getter, return the computed style of the node if passing in an ID or node,
		//		or return the normalized, computed value for the property when passing in a node and a style property
		// example:
		//		Passing only an ID or node returns the computed style object of
		//		the node:
		//	|	dojo.style("thinger");
		// example:
		//		Passing a node and a style property returns the current
		//		normalized, computed value for that property:
		//	|	dojo.style("thinger", "opacity"); // 1 by default
		//
		// example:
		//		Passing a node, a style property, and a value changes the
		//		current display of the node and returns the new computed value
		//	|	dojo.style("thinger", "opacity", 0.5); // == 0.5
		//
		// example:
		//		Passing a node, an object-style style property sets each of the values in turn and returns the computed style object of the node:
		//	|	dojo.style("thinger", {
		//	|		"opacity": 0.5,
		//	|		"border": "3px solid black",
		//	|		"height": "300px"
		//	|	});
		//
		// example:
		//		When the CSS style property is hyphenated, the JavaScript property is camelCased.
		//		font-size becomes fontSize, and so on.
		//	|	dojo.style("thinger",{
		//	|		fontSize:"14pt",
		//	|		letterSpacing:"1.2em"
		//	|	});
		//
		// example:
		//		dojo/NodeList implements .style() using the same syntax, omitting the "node" parameter, calling
		//		dojo.style() on every element of the list. See: `dojo/query` and `dojo/NodeList`
		//	|	dojo.query(".someClassName").style("visibility","hidden");
		//	|	// or
		//	|	dojo.query("#baz > div").style({
		//	|		opacity:0.75,
		//	|		fontSize:"13pt"
		//	|	});

		switch(arguments.length){
			case 1:
				return style.get(node);
			case 2:
				return style[typeof name == "string" ? "get" : "set"](node, name);
		}
		// setter
		return style.set(node, name, value);
	};

	return dojo;
});

},
'dojo/dnd/Container':function(){
define([
	"../_base/array",
	"../_base/declare",
	"../_base/kernel",
	"../_base/lang",
	"../_base/window",
	"../dom",
	"../dom-class",
	"../dom-construct",
	"../Evented",
	"../has",
	"../on",
	"../query",
	"../touch",
	"./common"
], function(
	array, declare, kernel, lang, win,
	dom, domClass, domConstruct, Evented, has, on, query, touch, dnd){

// module:
//		dojo/dnd/Container

/*
	Container states:
		""		- normal state
		"Over"	- mouse over a container
	Container item states:
		""		- normal state
		"Over"	- mouse over a container item
*/



var Container = declare("dojo.dnd.Container", Evented, {
	// summary:
	//		a Container object, which knows when mouse hovers over it,
	//		and over which element it hovers

	// object attributes (for markup)
	skipForm: false,
	// allowNested: Boolean
	//		Indicates whether to allow dnd item nodes to be nested within other elements.
	//		By default this is false, indicating that only direct children of the container can
	//		be draggable dnd item nodes
	allowNested: false,
	/*=====
	// current: DomNode
	//		The DOM node the mouse is currently hovered over
	current: null,

	// map: Hash<String, Container.Item>
	//		Map from an item's id (which is also the DOMNode's id) to
	//		the dojo/dnd/Container.Item itself.
	map: {},
	=====*/

	constructor: function(node, params){
		// summary:
		//		a constructor of the Container
		// node: Node
		//		node or node's id to build the container on
		// params: Container.__ContainerArgs
		//		a dictionary of parameters
		this.node = dom.byId(node);
		if(!params){ params = {}; }
		this.creator = params.creator || null;
		this.skipForm = params.skipForm;
		this.parent = params.dropParent && dom.byId(params.dropParent);

		// class-specific variables
		this.map = {};
		this.current = null;

		// states
		this.containerState = "";
		domClass.add(this.node, "dojoDndContainer");

		// mark up children
		if(!(params && params._skipStartup)){
			this.startup();
		}

		// set up events
		this.events = [
			on(this.node, touch.over, lang.hitch(this, "onMouseOver")),
			on(this.node, touch.out,  lang.hitch(this, "onMouseOut")),
			// cancel text selection and text dragging
			on(this.node, "dragstart",   lang.hitch(this, "onSelectStart")),
			on(this.node, "selectstart", lang.hitch(this, "onSelectStart"))
		];
	},

	// object attributes (for markup)
	creator: function(){
		// summary:
		//		creator function, dummy at the moment
	},

	// abstract access to the map
	getItem: function(/*String*/ key){
		// summary:
		//		returns a data item by its key (id)
		return this.map[key];	// Container.Item
	},
	setItem: function(/*String*/ key, /*Container.Item*/ data){
		// summary:
		//		associates a data item with its key (id)
		this.map[key] = data;
	},
	delItem: function(/*String*/ key){
		// summary:
		//		removes a data item from the map by its key (id)
		delete this.map[key];
	},
	forInItems: function(/*Function*/ f, /*Object?*/ o){
		// summary:
		//		iterates over a data map skipping members that
		//		are present in the empty object (IE and/or 3rd-party libraries).
		o = o || kernel.global;
		var m = this.map, e = dnd._empty;
		for(var i in m){
			if(i in e){ continue; }
			f.call(o, m[i], i, this);
		}
		return o;	// Object
	},
	clearItems: function(){
		// summary:
		//		removes all data items from the map
		this.map = {};
	},

	// methods
	getAllNodes: function(){
		// summary:
		//		returns a list (an array) of all valid child nodes
		return query((this.allowNested ? "" : "> ") + ".dojoDndItem", this.parent);	// NodeList
	},
	sync: function(){
		// summary:
		//		sync up the node list with the data map
		var map = {};
		this.getAllNodes().forEach(function(node){
			if(node.id){
				var item = this.getItem(node.id);
				if(item){
					map[node.id] = item;
					return;
				}
			}else{
				node.id = dnd.getUniqueId();
			}
			var type = node.getAttribute("dndType"),
				data = node.getAttribute("dndData");
			map[node.id] = {
				data: data || node.innerHTML,
				type: type ? type.split(/\s*,\s*/) : ["text"]
			};
		}, this);
		this.map = map;
		return this;	// self
	},
	insertNodes: function(data, before, anchor){
		// summary:
		//		inserts an array of new nodes before/after an anchor node
		// data: Array
		//		a list of data items, which should be processed by the creator function
		// before: Boolean
		//		insert before the anchor, if true, and after the anchor otherwise
		// anchor: Node
		//		the anchor node to be used as a point of insertion
		if(!this.parent.firstChild){
			anchor = null;
		}else if(before){
			if(!anchor){
				anchor = this.parent.firstChild;
			}
		}else{
			if(anchor){
				anchor = anchor.nextSibling;
			}
		}
		var i, t;
		if(anchor){
			for(i = 0; i < data.length; ++i){
				t = this._normalizedCreator(data[i]);
				this.setItem(t.node.id, {data: t.data, type: t.type});
				anchor.parentNode.insertBefore(t.node, anchor);
			}
		}else{
			for(i = 0; i < data.length; ++i){
				t = this._normalizedCreator(data[i]);
				this.setItem(t.node.id, {data: t.data, type: t.type});
				this.parent.appendChild(t.node);
			}
		}
		return this;	// self
	},
	destroy: function(){
		// summary:
		//		prepares this object to be garbage-collected
		array.forEach(this.events, function(handle){ handle.remove(); });
		this.clearItems();
		this.node = this.parent = this.current = null;
	},

	// markup methods
	markupFactory: function(params, node, Ctor){
		params._skipStartup = true;
		return new Ctor(node, params);
	},
	startup: function(){
		// summary:
		//		collects valid child items and populate the map

		// set up the real parent node
		if(!this.parent){
			// use the standard algorithm, if not assigned
			this.parent = this.node;
			if(this.parent.tagName.toLowerCase() == "table"){
				var c = this.parent.getElementsByTagName("tbody");
				if(c && c.length){ this.parent = c[0]; }
			}
		}
		this.defaultCreator = dnd._defaultCreator(this.parent);

		// process specially marked children
		this.sync();
	},

	// mouse events
	onMouseOver: function(e){
		// summary:
		//		event processor for onmouseover or touch, to mark that element as the current element
		// e: Event
		//		mouse event
		var n = e.relatedTarget;
		while(n){
			if(n == this.node){ break; }
			try{
				n = n.parentNode;
			}catch(x){
				n = null;
			}
		}
		if(!n){
			this._changeState("Container", "Over");
			this.onOverEvent();
		}
		n = this._getChildByEvent(e);
		if(this.current == n){ return; }
		if(this.current){ this._removeItemClass(this.current, "Over"); }
		if(n){ this._addItemClass(n, "Over"); }
		this.current = n;
	},
	onMouseOut: function(e){
		// summary:
		//		event processor for onmouseout
		// e: Event
		//		mouse event
		for(var n = e.relatedTarget; n;){
			if(n == this.node){ return; }
			try{
				n = n.parentNode;
			}catch(x){
				n = null;
			}
		}
		if(this.current){
			this._removeItemClass(this.current, "Over");
			this.current = null;
		}
		this._changeState("Container", "");
		this.onOutEvent();
	},
	onSelectStart: function(e){
		// summary:
		//		event processor for onselectevent and ondragevent
		// e: Event
		//		mouse event
		if(!this.skipForm || !dnd.isFormElement(e)){
			e.stopPropagation();
			e.preventDefault();
		}
	},

	// utilities
	onOverEvent: function(){
		// summary:
		//		this function is called once, when mouse is over our container
	},
	onOutEvent: function(){
		// summary:
		//		this function is called once, when mouse is out of our container
	},
	_changeState: function(type, newState){
		// summary:
		//		changes a named state to new state value
		// type: String
		//		a name of the state to change
		// newState: String
		//		new state
		var prefix = "dojoDnd" + type;
		var state  = type.toLowerCase() + "State";
		//domClass.replace(this.node, prefix + newState, prefix + this[state]);
		domClass.replace(this.node, prefix + newState, prefix + this[state]);
		this[state] = newState;
	},
	_addItemClass: function(node, type){
		// summary:
		//		adds a class with prefix "dojoDndItem"
		// node: Node
		//		a node
		// type: String
		//		a variable suffix for a class name
		domClass.add(node, "dojoDndItem" + type);
	},
	_removeItemClass: function(node, type){
		// summary:
		//		removes a class with prefix "dojoDndItem"
		// node: Node
		//		a node
		// type: String
		//		a variable suffix for a class name
		domClass.remove(node, "dojoDndItem" + type);
	},
	_getChildByEvent: function(e){
		// summary:
		//		gets a child, which is under the mouse at the moment, or null
		// e: Event
		//		a mouse event
		var node = e.target;
		if(node){
			for(var parent = node.parentNode; parent; node = parent, parent = node.parentNode){
				if((parent == this.parent || this.allowNested) && domClass.contains(node, "dojoDndItem")){ return node; }
			}
		}
		return null;
	},
	_normalizedCreator: function(/*Container.Item*/ item, /*String*/ hint){
		// summary:
		//		adds all necessary data to the output of the user-supplied creator function
		var t = (this.creator || this.defaultCreator).call(this, item, hint);
		if(!lang.isArray(t.type)){ t.type = ["text"]; }
		if(!t.node.id){ t.node.id = dnd.getUniqueId(); }
		domClass.add(t.node, "dojoDndItem");
		return t;
	}
});

dnd._createNode = function(tag){
	// summary:
	//		returns a function, which creates an element of given tag
	//		(SPAN by default) and sets its innerHTML to given text
	// tag: String
	//		a tag name or empty for SPAN
	if(!tag){ return dnd._createSpan; }
	return function(text){	// Function
		return domConstruct.create(tag, {innerHTML: text});	// Node
	};
};

dnd._createTrTd = function(text){
	// summary:
	//		creates a TR/TD structure with given text as an innerHTML of TD
	// text: String
	//		a text for TD
	var tr = domConstruct.create("tr");
	domConstruct.create("td", {innerHTML: text}, tr);
	return tr;	// Node
};

dnd._createSpan = function(text){
	// summary:
	//		creates a SPAN element with given text as its innerHTML
	// text: String
	//		a text for SPAN
	return domConstruct.create("span", {innerHTML: text});	// Node
};

// dnd._defaultCreatorNodes: Object
//		a dictionary that maps container tag names to child tag names
dnd._defaultCreatorNodes = {ul: "li", ol: "li", div: "div", p: "div"};

dnd._defaultCreator = function(node){
	// summary:
	//		takes a parent node, and returns an appropriate creator function
	// node: Node
	//		a container node
	var tag = node.tagName.toLowerCase();
	var c = tag == "tbody" || tag == "thead" ? dnd._createTrTd :
			dnd._createNode(dnd._defaultCreatorNodes[tag]);
	return function(item, hint){	// Function
		var isObj = item && lang.isObject(item), data, type, n;
		if(isObj && item.tagName && item.nodeType && item.getAttribute){
			// process a DOM node
			data = item.getAttribute("dndData") || item.innerHTML;
			type = item.getAttribute("dndType");
			type = type ? type.split(/\s*,\s*/) : ["text"];
			n = item;	// this node is going to be moved rather than copied
		}else{
			// process a DnD item object or a string
			data = (isObj && item.data) ? item.data : item;
			type = (isObj && item.type) ? item.type : ["text"];
			n = (hint == "avatar" ? dnd._createSpan : c)(String(data));
		}
		if(!n.id){
			n.id = dnd.getUniqueId();
		}
		return {node: n, data: data, type: type};
	};
};

/*=====
Container.__ContainerArgs = declare([], {
	creator: function(){
		// summary:
		//		a creator function, which takes a data item, and returns an object like that:
		//		{node: newNode, data: usedData, type: arrayOfStrings}
	},

	// skipForm: Boolean
	//		don't start the drag operation, if clicked on form elements
	skipForm: false,

	// dropParent: Node||String
	//		node or node's id to use as the parent node for dropped items
	//		(must be underneath the 'node' parameter in the DOM)
	dropParent: null,

	// _skipStartup: Boolean
	//		skip startup(), which collects children, for deferred initialization
	//		(this is used in the markup mode)
	_skipStartup: false
});

Container.Item = function(){
	// summary:
	//		Represents (one of) the source node(s) being dragged.
	//		Contains (at least) the "type" and "data" attributes.
	// type: String[]
	//		Type(s) of this item, by default this is ["text"]
	// data: Object
	//		Logical representation of the object being dragged.
	//		If the drag object's type is "text" then data is a String,
	//		if it's another type then data could be a different Object,
	//		perhaps a name/value hash.

	this.type = type;
	this.data = data;
};
=====*/

return Container;
});

},
'dojo/dnd/Manager':function(){
define([
	"../_base/array",  "../_base/declare", "../_base/lang", "../_base/window",
	"../dom-class", "../Evented", "../has", "../keys", "../on", "../topic", "../touch",
	"./common", "./autoscroll", "./Avatar"
], function(array, declare, lang, win, domClass, Evented, has, keys, on, topic, touch,
	dnd, autoscroll, Avatar){

// module:
//		dojo/dnd/Manager

var Manager = declare("dojo.dnd.Manager", [Evented], {
	// summary:
	//		the manager of DnD operations (usually a singleton)
	constructor: function(){
		this.avatar  = null;
		this.source = null;
		this.nodes = [];
		this.copy  = true;
		this.target = null;
		this.canDropFlag = false;
		this.events = [];
	},

	// avatar's offset from the mouse
	OFFSET_X: has("touch") ? 0 : 16,
	OFFSET_Y: has("touch") ? -64 : 16,

	// methods
	overSource: function(source){
		// summary:
		//		called when a source detected a mouse-over condition
		// source: Object
		//		the reporter
		if(this.avatar){
			this.target = (source && source.targetState != "Disabled") ? source : null;
			this.canDropFlag = Boolean(this.target);
			this.avatar.update();
		}
		topic.publish("/dnd/source/over", source);
	},
	outSource: function(source){
		// summary:
		//		called when a source detected a mouse-out condition
		// source: Object
		//		the reporter
		if(this.avatar){
			if(this.target == source){
				this.target = null;
				this.canDropFlag = false;
				this.avatar.update();
				topic.publish("/dnd/source/over", null);
			}
		}else{
			topic.publish("/dnd/source/over", null);
		}
	},
	startDrag: function(source, nodes, copy){
		// summary:
		//		called to initiate the DnD operation
		// source: Object
		//		the source which provides items
		// nodes: Array
		//		the list of transferred items
		// copy: Boolean
		//		copy items, if true, move items otherwise

		// Tell autoscroll that a drag is starting
		autoscroll.autoScrollStart(win.doc);

		this.source = source;
		this.nodes  = nodes;
		this.copy   = Boolean(copy); // normalizing to true boolean
		this.avatar = this.makeAvatar();
		win.body().appendChild(this.avatar.node);
		topic.publish("/dnd/start", source, nodes, this.copy);

		function stopEvent(e){
			e.preventDefault();
			e.stopPropagation();
		}

		this.events = [
			on(win.doc, touch.move, lang.hitch(this, "onMouseMove")),
			on(win.doc, touch.release,   lang.hitch(this, "onMouseUp")),
			on(win.doc, "keydown",   lang.hitch(this, "onKeyDown")),
			on(win.doc, "keyup",     lang.hitch(this, "onKeyUp")),

			// cancel text selection and text dragging
			on(win.doc, "dragstart",   stopEvent),
			on(win.body(), "selectstart", stopEvent)
		];
		var c = "dojoDnd" + (copy ? "Copy" : "Move");
		domClass.add(win.body(), c);
	},
	canDrop: function(flag){
		// summary:
		//		called to notify if the current target can accept items
		var canDropFlag = Boolean(this.target && flag);
		if(this.canDropFlag != canDropFlag){
			this.canDropFlag = canDropFlag;
			this.avatar.update();
		}
	},
	stopDrag: function(){
		// summary:
		//		stop the DnD in progress
		domClass.remove(win.body(), ["dojoDndCopy", "dojoDndMove"]);
		array.forEach(this.events, function(handle){ handle.remove(); });
		this.events = [];
		this.avatar.destroy();
		this.avatar = null;
		this.source = this.target = null;
		this.nodes = [];
	},
	makeAvatar: function(){
		// summary:
		//		makes the avatar; it is separate to be overwritten dynamically, if needed
		return new Avatar(this);
	},
	updateAvatar: function(){
		// summary:
		//		updates the avatar; it is separate to be overwritten dynamically, if needed
		this.avatar.update();
	},

	// mouse event processors
	onMouseMove: function(e){
		// summary:
		//		event processor for onmousemove
		// e: Event
		//		mouse event
		var a = this.avatar;
		if(a){
			autoscroll.autoScrollNodes(e);
			//autoscroll.autoScroll(e);
			var s = a.node.style;
			s.left = (e.pageX + this.OFFSET_X) + "px";
			s.top  = (e.pageY + this.OFFSET_Y) + "px";
			var copy = Boolean(this.source.copyState(dnd.getCopyKeyState(e)));
			if(this.copy != copy){
				this._setCopyStatus(copy);
			}
		}
		if(has("touch")){
			// Prevent page from scrolling so that user can drag instead.
			e.preventDefault();
		}
	},
	onMouseUp: function(e){
		// summary:
		//		event processor for onmouseup
		// e: Event
		//		mouse event
		if(this.avatar){
			if(this.target && this.canDropFlag){
				var copy = Boolean(this.source.copyState(dnd.getCopyKeyState(e)));
				topic.publish("/dnd/drop/before", this.source, this.nodes, copy, this.target, e);
				topic.publish("/dnd/drop", this.source, this.nodes, copy, this.target, e);
			}else{
				topic.publish("/dnd/cancel");
			}
			this.stopDrag();
		}
	},

	// keyboard event processors
	onKeyDown: function(e){
		// summary:
		//		event processor for onkeydown:
		//		watching for CTRL for copy/move status, watching for ESCAPE to cancel the drag
		// e: Event
		//		keyboard event
		if(this.avatar){
			switch(e.keyCode){
				case keys.CTRL:
					var copy = Boolean(this.source.copyState(true));
					if(this.copy != copy){
						this._setCopyStatus(copy);
					}
					break;
				case keys.ESCAPE:
					topic.publish("/dnd/cancel");
					this.stopDrag();
					break;
			}
		}
	},
	onKeyUp: function(e){
		// summary:
		//		event processor for onkeyup, watching for CTRL for copy/move status
		// e: Event
		//		keyboard event
		if(this.avatar && e.keyCode == keys.CTRL){
			var copy = Boolean(this.source.copyState(false));
			if(this.copy != copy){
				this._setCopyStatus(copy);
			}
		}
	},

	// utilities
	_setCopyStatus: function(copy){
		// summary:
		//		changes the copy status
		// copy: Boolean
		//		the copy status
		this.copy = copy;
		this.source._markDndStatus(this.copy);
		this.updateAvatar();
		domClass.replace(win.body(),
			"dojoDnd" + (this.copy ? "Copy" : "Move"),
			"dojoDnd" + (this.copy ? "Move" : "Copy"));
	}
});

// dnd._manager:
//		The manager singleton variable. Can be overwritten if needed.
dnd._manager = null;

Manager.manager = dnd.manager = function(){
	// summary:
	//		Returns the current DnD manager.  Creates one if it is not created yet.
	if(!dnd._manager){
		dnd._manager = new Manager();
	}
	return dnd._manager;	// Object
};

// TODO: for 2.0, store _manager and manager in Manager only.   Don't access dnd or dojo.dnd.

return Manager;
});

},
'dojo/dnd/Avatar':function(){
define([
	"../_base/declare",
	"../_base/window",
	"../dom",
	"../dom-attr",
	"../dom-class",
	"../dom-construct",
	"../hccss",
	"../query"
], function(declare, win, dom, domAttr, domClass, domConstruct, has, query){

// module:
//		dojo/dnd/Avatar

return declare("dojo.dnd.Avatar", null, {
	// summary:
	//		Object that represents transferred DnD items visually
	// manager: Object
	//		a DnD manager object

	constructor: function(manager){
		this.manager = manager;
		this.construct();
	},

	// methods
	construct: function(){
		// summary:
		//		constructor function;
		//		it is separate so it can be (dynamically) overwritten in case of need

		var a = domConstruct.create("table", {
				"class": "dojoDndAvatar",
				style: {
					position: "absolute",
					zIndex:   "1999",
					margin:   "0px"
				}
			}),
			source = this.manager.source, node,
			b = domConstruct.create("tbody", null, a),
			tr = domConstruct.create("tr", null, b),
			td = domConstruct.create("td", null, tr),
			k = Math.min(5, this.manager.nodes.length), i = 0;

		if(has("highcontrast")){
			domConstruct.create("span", {
				id : "a11yIcon",
				innerHTML : this.manager.copy ? '+' : "<"
			}, td)
		}
		domConstruct.create("span", {
			innerHTML: source.generateText ? this._generateText() : ""
		}, td);

		// we have to set the opacity on IE only after the node is live
		domAttr.set(tr, {
			"class": "dojoDndAvatarHeader",
			style: {opacity: 0.9}
		});
		for(; i < k; ++i){
			if(source.creator){
				// create an avatar representation of the node
				node = source._normalizedCreator(source.getItem(this.manager.nodes[i].id).data, "avatar").node;
			}else{
				// or just clone the node and hope it works
				node = this.manager.nodes[i].cloneNode(true);
				if(node.tagName.toLowerCase() == "tr"){
					// insert extra table nodes
					var table = domConstruct.create("table"),
						tbody = domConstruct.create("tbody", null, table);
					tbody.appendChild(node);
					node = table;
				}
			}
			node.id = "";
			tr = domConstruct.create("tr", null, b);
			td = domConstruct.create("td", null, tr);
			td.appendChild(node);
			domAttr.set(tr, {
				"class": "dojoDndAvatarItem",
				style: {opacity: (9 - i) / 10}
			});
		}
		this.node = a;
	},
	destroy: function(){
		// summary:
		//		destructor for the avatar; called to remove all references so it can be garbage-collected
		domConstruct.destroy(this.node);
		this.node = false;
	},
	update: function(){
		// summary:
		//		updates the avatar to reflect the current DnD state
		domClass.toggle(this.node, "dojoDndAvatarCanDrop", this.manager.canDropFlag);
		if(has("highcontrast")){
			var icon = dom.byId("a11yIcon");
			var text = '+';   // assume canDrop && copy
			if (this.manager.canDropFlag && !this.manager.copy){
				text = '< '; // canDrop && move
			}else if (!this.manager.canDropFlag && !this.manager.copy){
				text = "o"; //!canDrop && move
			}else if(!this.manager.canDropFlag){
				text = 'x';  // !canDrop && copy
			}
			icon.innerHTML=text;
		}
		// replace text
		query(("tr.dojoDndAvatarHeader td span" +(has("highcontrast") ? " span" : "")), this.node).forEach(
			function(node){
				node.innerHTML = this.manager.source.generateText ? this._generateText() : "";
			}, this);
	},
	_generateText: function(){
		// summary:
		//		generates a proper text to reflect copying or moving of items
		return this.manager.nodes.length.toString();
	}
});

});

},
'dijit/tree/dndSource':function(){
define([
	"dojo/_base/array", // array.forEach array.indexOf array.map
	"dojo/_base/connect", // isCopyKey
	"dojo/_base/declare", // declare
	"dojo/dom-class", // domClass.add
	"dojo/dom-geometry", // domGeometry.position
	"dojo/_base/lang", // lang.mixin lang.hitch
	"dojo/on", // subscribe
	"dojo/touch",
	"dojo/topic",
	"dojo/dnd/Manager", // DNDManager.manager
	"./_dndSelector"
], function(array, connect, declare, domClass, domGeometry, lang, on, touch, topic, DNDManager, _dndSelector){

	// module:
	//		dijit/tree/dndSource

	/*=====
	var __Item = {
		// summary:
		//		New item to be added to the Tree, like:
		// id: Anything
		id: "",
		// name: String
		name: ""
	};
	=====*/

	var dndSource = declare("dijit.tree.dndSource", _dndSelector, {
		// summary:
		//		Handles drag and drop operations (as a source or a target) for `dijit.Tree`

		// isSource: Boolean
		//		Can be used as a DnD source.
		isSource: true,

		// accept: String[]
		//		List of accepted types (text strings) for the Tree; defaults to
		//		["text"]
		accept: ["text", "treeNode"],

		// copyOnly: [private] Boolean
		//		Copy items, if true, use a state of Ctrl key otherwise
		copyOnly: false,

		// dragThreshold: Number
		//		The move delay in pixels before detecting a drag; 5 by default
		dragThreshold: 5,

		// betweenThreshold: Integer
		//		Distance from upper/lower edge of node to allow drop to reorder nodes
		betweenThreshold: 0,

		// Flag used by Avatar.js to signal to generate text node when dragging
		generateText: true,

		constructor: function(/*dijit/Tree*/ tree, /*dijit/tree/dndSource*/ params){
			// summary:
			//		a constructor of the Tree DnD Source
			// tags:
			//		private
			if(!params){
				params = {};
			}
			lang.mixin(this, params);
			var type = params.accept instanceof Array ? params.accept : ["text", "treeNode"];
			this.accept = null;
			if(type.length){
				this.accept = {};
				for(var i = 0; i < type.length; ++i){
					this.accept[type[i]] = 1;
				}
			}

			// class-specific variables
			this.isDragging = false;
			this.mouseDown = false;
			this.targetAnchor = null;	// DOMNode corresponding to the currently moused over TreeNode
			this.targetBox = null;	// coordinates of this.targetAnchor
			this.dropPosition = "";	// whether mouse is over/after/before this.targetAnchor
			this._lastX = 0;
			this._lastY = 0;

			// states
			this.sourceState = "";
			if(this.isSource){
				domClass.add(this.node, "dojoDndSource");
			}
			this.targetState = "";
			if(this.accept){
				domClass.add(this.node, "dojoDndTarget");
			}

			// set up events
			this.topics = [
				topic.subscribe("/dnd/source/over", lang.hitch(this, "onDndSourceOver")),
				topic.subscribe("/dnd/start", lang.hitch(this, "onDndStart")),
				topic.subscribe("/dnd/drop", lang.hitch(this, "onDndDrop")),
				topic.subscribe("/dnd/cancel", lang.hitch(this, "onDndCancel"))
			];
		},

		// methods
		checkAcceptance: function(/*===== source, nodes =====*/){
			// summary:
			//		Checks if the target can accept nodes from this source
			// source: dijit/tree/dndSource
			//		The source which provides items
			// nodes: DOMNode[]
			//		Array of DOM nodes corresponding to nodes being dropped, dijitTreeRow nodes if
			//		source is a dijit/Tree.
			// tags:
			//		extension
			return true;	// Boolean
		},

		copyState: function(keyPressed){
			// summary:
			//		Returns true, if we need to copy items, false to move.
			//		It is separated to be overwritten dynamically, if needed.
			// keyPressed: Boolean
			//		The "copy" control key was pressed
			// tags:
			//		protected
			return this.copyOnly || keyPressed;	// Boolean
		},
		destroy: function(){
			// summary:
			//		Prepares the object to be garbage-collected.
			this.inherited(arguments);
			var h;
			while(h = this.topics.pop()){
				h.remove();
			}
			this.targetAnchor = null;
		},

		_onDragMouse: function(e, firstTime){
			// summary:
			//		Helper method for processing onmousemove/onmouseover events while drag is in progress.
			//		Keeps track of current drop target.
			// e: Event
			//		The mousemove event.
			// firstTime: Boolean?
			//		If this flag is set, this is the first mouse move event of the drag, so call m.canDrop() etc.
			//		even if newTarget == null because the user quickly dragged a node in the Tree to a position
			//		over Tree.containerNode but not over any TreeNode (#7971)

			var m = DNDManager.manager(),
				oldTarget = this.targetAnchor, // the TreeNode corresponding to TreeNode mouse was previously over
				newTarget = this.current, // TreeNode corresponding to TreeNode mouse is currently over
				oldDropPosition = this.dropPosition;	// the previous drop position (over/before/after)

			// calculate if user is indicating to drop the dragged node before, after, or over
			// (i.e., to become a child of) the target node
			var newDropPosition = "Over";
			if(newTarget && this.betweenThreshold > 0){
				// If mouse is over a new TreeNode, then get new TreeNode's position and size
				if(!this.targetBox || oldTarget != newTarget){
					this.targetBox = domGeometry.position(newTarget.rowNode, true);
				}
				if((e.pageY - this.targetBox.y) <= this.betweenThreshold){
					newDropPosition = "Before";
				}else if((e.pageY - this.targetBox.y) >= (this.targetBox.h - this.betweenThreshold)){
					newDropPosition = "After";
				}
			}

			if(firstTime || newTarget != oldTarget || newDropPosition != oldDropPosition){
				if(oldTarget){
					this._removeItemClass(oldTarget.rowNode, oldDropPosition);
				}
				if(newTarget){
					this._addItemClass(newTarget.rowNode, newDropPosition);
				}

				// Check if it's ok to drop the dragged node on/before/after the target node.
				if(!newTarget){
					m.canDrop(false);
				}else if(newTarget == this.tree.rootNode && newDropPosition != "Over"){
					// Can't drop before or after tree's root node; the dropped node would just disappear (at least visually)
					m.canDrop(false);
				}else{
					// Guard against dropping onto yourself (TODO: guard against dropping onto your descendant, #7140)
					var sameId = false;
					if(m.source == this){
						for(var dragId in this.selection){
							var dragNode = this.selection[dragId];
							if(dragNode.item === newTarget.item){
								sameId = true;
								break;
							}
						}
					}
					if(sameId){
						m.canDrop(false);
					}else if(this.checkItemAcceptance(newTarget.rowNode, m.source, newDropPosition.toLowerCase())
						&& !this._isParentChildDrop(m.source, newTarget.rowNode)){
						m.canDrop(true);
					}else{
						m.canDrop(false);
					}
				}

				this.targetAnchor = newTarget;
				this.dropPosition = newDropPosition;
			}
		},

		onMouseMove: function(e){
			// summary:
			//		Called for any onmousemove/ontouchmove events over the Tree
			// e: Event
			//		onmousemouse/ontouchmove event
			// tags:
			//		private
			if(this.isDragging && this.targetState == "Disabled"){
				return;
			}
			this.inherited(arguments);
			var m = DNDManager.manager();
			if(this.isDragging){
				this._onDragMouse(e);
			}else{
				if(this.mouseDown && this.isSource &&
					(Math.abs(e.pageX - this._lastX) >= this.dragThreshold || Math.abs(e.pageY - this._lastY) >= this.dragThreshold)){
					var nodes = this.getSelectedTreeNodes();
					if(nodes.length){
						if(nodes.length > 1){
							//filter out all selected items which has one of their ancestor selected as well
							var seen = this.selection, i = 0, r = [], n, p;
							nextitem: while((n = nodes[i++])){
								for(p = n.getParent(); p && p !== this.tree; p = p.getParent()){
									if(seen[p.id]){ //parent is already selected, skip this node
										continue nextitem;
									}
								}
								//this node does not have any ancestors selected, add it
								r.push(n);
							}
							nodes = r;
						}
						nodes = array.map(nodes, function(n){
							return n.domNode
						});
						m.startDrag(this, nodes, this.copyState(connect.isCopyKey(e)));
						this._onDragMouse(e, true);	// because this may be the only mousemove event we get before the drop
					}
				}
			}
		},

		onMouseDown: function(e){
			// summary:
			//		Event processor for onmousedown/ontouchstart
			// e: Event
			//		onmousedown/ontouchend event
			// tags:
			//		private
			this.mouseDown = true;
			this.mouseButton = e.button;
			this._lastX = e.pageX;
			this._lastY = e.pageY;
			this.inherited(arguments);
		},

		onMouseUp: function(e){
			// summary:
			//		Event processor for onmouseup/ontouchend
			// e: Event
			//		onmouseup/ontouchend event
			// tags:
			//		private
			if(this.mouseDown){
				this.mouseDown = false;
				this.inherited(arguments);
			}
		},

		onMouseOut: function(){
			// summary:
			//		Event processor for when mouse is moved away from a TreeNode
			// tags:
			//		private
			this.inherited(arguments);
			this._unmarkTargetAnchor();
		},

		checkItemAcceptance: function(/*===== target, source, position =====*/){
			// summary:
			//		Stub function to be overridden if one wants to check for the ability to drop at the node/item level
			// description:
			//		In the base case, this is called to check if target can become a child of source.
			//		When betweenThreshold is set, position="before" or "after" means that we
			//		are asking if the source node can be dropped before/after the target node.
			// target: DOMNode
			//		The dijitTreeRoot DOM node inside of the TreeNode that we are dropping on to
			//		Use dijit.getEnclosingWidget(target) to get the TreeNode.
			// source: dijit/tree/dndSource
			//		The (set of) nodes we are dropping
			// position: String
			//		"over", "before", or "after"
			// tags:
			//		extension
			return true;
		},

		// topic event processors
		onDndSourceOver: function(source){
			// summary:
			//		Topic event processor for /dnd/source/over, called when detected a current source.
			// source: Object
			//		The dijit/tree/dndSource / dojo/dnd/Source which has the mouse over it
			// tags:
			//		private
			if(this != source){
				this.mouseDown = false;
				this._unmarkTargetAnchor();
			}else if(this.isDragging){
				var m = DNDManager.manager();
				m.canDrop(false);
			}
		},
		onDndStart: function(source, nodes, copy){
			// summary:
			//		Topic event processor for /dnd/start, called to initiate the DnD operation
			// source: Object
			//		The dijit/tree/dndSource / dojo/dnd/Source which is providing the items
			// nodes: DomNode[]
			//		The list of transferred items, dndTreeNode nodes if dragging from a Tree
			// copy: Boolean
			//		Copy items, if true, move items otherwise
			// tags:
			//		private

			if(this.isSource){
				this._changeState("Source", this == source ? (copy ? "Copied" : "Moved") : "");
			}
			var accepted = this.checkAcceptance(source, nodes);

			this._changeState("Target", accepted ? "" : "Disabled");

			if(this == source){
				DNDManager.manager().overSource(this);
			}

			this.isDragging = true;
		},

		itemCreator: function(nodes /*===== , target, source =====*/){
			// summary:
			//		Returns objects passed to `Tree.model.newItem()` based on DnD nodes
			//		dropped onto the tree.   Developer must override this method to enable
			//		dropping from external sources onto this Tree, unless the Tree.model's items
			//		happen to look like {id: 123, name: "Apple" } with no other attributes.
			// description:
			//		For each node in nodes[], which came from source, create a hash of name/value
			//		pairs to be passed to Tree.model.newItem().  Returns array of those hashes.
			// nodes: DomNode[]
			// target: DomNode
			// source: dojo/dnd/Source
			// returns: __Item[]
			//		Array of name/value hashes for each new item to be added to the Tree
			// tags:
			//		extension

			// TODO: for 2.0 refactor so itemCreator() is called once per drag node, and
			// make signature itemCreator(sourceItem, node, target) (or similar).

			return array.map(nodes, function(node){
				return {
					"id": node.id,
					"name": node.textContent || node.innerText || ""
				};
			}); // Object[]
		},

		onDndDrop: function(source, nodes, copy){
			// summary:
			//		Topic event processor for /dnd/drop, called to finish the DnD operation.
			// description:
			//		Updates data store items according to where node was dragged from and dropped
			//		to.   The tree will then respond to those data store updates and redraw itself.
			// source: Object
			//		The dijit/tree/dndSource / dojo/dnd/Source which is providing the items
			// nodes: DomNode[]
			//		The list of transferred items, dndTreeNode nodes if dragging from a Tree
			// copy: Boolean
			//		Copy items, if true, move items otherwise
			// tags:
			//		protected
			if(this.containerState == "Over"){
				var tree = this.tree,
					model = tree.model,
					target = this.targetAnchor;

				this.isDragging = false;

				// Compute the new parent item
				var newParentItem;
				var insertIndex;
				var before;		// drop source before (aka previous sibling) of target
				newParentItem = (target && target.item) || tree.item;
				if(this.dropPosition == "Before" || this.dropPosition == "After"){
					// TODO: if there is no parent item then disallow the drop.
					// Actually this should be checked during onMouseMove too, to make the drag icon red.
					newParentItem = (target.getParent() && target.getParent().item) || tree.item;
					// Compute the insert index for reordering
					insertIndex = target.getIndexInParent();
					if(this.dropPosition == "After"){
						insertIndex = target.getIndexInParent() + 1;
						before = target.getNextSibling() && target.getNextSibling().item;
					}else{
						before = target.item;
					}
				}else{
					newParentItem = (target && target.item) || tree.item;
				}

				// If necessary, use this variable to hold array of hashes to pass to model.newItem()
				// (one entry in the array for each dragged node).
				var newItemsParams;

				array.forEach(nodes, function(node, idx){
					// dojo/dnd/Item representing the thing being dropped.
					// Don't confuse the use of item here (meaning a DnD item) with the
					// uses below where item means dojo.data item.
					var sourceItem = source.getItem(node.id);

					// Information that's available if the source is another Tree
					// (possibly but not necessarily this tree, possibly but not
					// necessarily the same model as this Tree)
					if(array.indexOf(sourceItem.type, "treeNode") != -1){
						var childTreeNode = sourceItem.data,
							childItem = childTreeNode.item,
							oldParentItem = childTreeNode.getParent().item;
					}

					if(source == this){
						// This is a node from my own tree, and we are moving it, not copying.
						// Remove item from old parent's children attribute.
						// TODO: dijit/tree/dndSelector should implement deleteSelectedNodes()
						// and this code should go there.

						if(typeof insertIndex == "number"){
							if(newParentItem == oldParentItem && childTreeNode.getIndexInParent() < insertIndex){
								insertIndex -= 1;
							}
						}
						model.pasteItem(childItem, oldParentItem, newParentItem, copy, insertIndex, before);
					}else if(model.isItem(childItem)){
						// Item from same model
						// (maybe we should only do this branch if the source is a tree?)
						model.pasteItem(childItem, oldParentItem, newParentItem, copy, insertIndex, before);
					}else{
						// Get the hash to pass to model.newItem().  A single call to
						// itemCreator() returns an array of hashes, one for each drag source node.
						if(!newItemsParams){
							newItemsParams = this.itemCreator(nodes, target.rowNode, source);
						}

						// Create new item in the tree, based on the drag source.
						model.newItem(newItemsParams[idx], newParentItem, insertIndex, before);
					}
				}, this);

				// Expand the target node (if it's currently collapsed) so the user can see
				// where their node was dropped.   In particular since that node is still selected.
				this.tree._expandNode(target);
			}
			this.onDndCancel();
		},

		onDndCancel: function(){
			// summary:
			//		Topic event processor for /dnd/cancel, called to cancel the DnD operation
			// tags:
			//		private
			this._unmarkTargetAnchor();
			this.isDragging = false;
			this.mouseDown = false;
			delete this.mouseButton;
			this._changeState("Source", "");
			this._changeState("Target", "");
		},

		// When focus moves in/out of the entire Tree
		onOverEvent: function(){
			// summary:
			//		This method is called when mouse is moved over our container (like onmouseenter)
			// tags:
			//		private
			this.inherited(arguments);
			DNDManager.manager().overSource(this);
		},
		onOutEvent: function(){
			// summary:
			//		This method is called when mouse is moved out of our container (like onmouseleave)
			// tags:
			//		private
			this._unmarkTargetAnchor();
			var m = DNDManager.manager();
			if(this.isDragging){
				m.canDrop(false);
			}
			m.outSource(this);

			this.inherited(arguments);
		},

		_isParentChildDrop: function(source, targetRow){
			// summary:
			//		Checks whether the dragged items are parent rows in the tree which are being
			//		dragged into their own children.
			//
			// source:
			//		The DragSource object.
			//
			// targetRow:
			//		The tree row onto which the dragged nodes are being dropped.
			//
			// tags:
			//		private

			// If the dragged object is not coming from the tree this widget belongs to,
			// it cannot be invalid.
			if(!source.tree || source.tree != this.tree){
				return false;
			}


			var root = source.tree.domNode;
			var ids = source.selection;

			var node = targetRow.parentNode;

			// Iterate up the DOM hierarchy from the target drop row,
			// checking of any of the dragged nodes have the same ID.
			while(node != root && !ids[node.id]){
				node = node.parentNode;
			}

			return node.id && ids[node.id];
		},

		_unmarkTargetAnchor: function(){
			// summary:
			//		Removes hover class of the current target anchor
			// tags:
			//		private
			if(!this.targetAnchor){
				return;
			}
			this._removeItemClass(this.targetAnchor.rowNode, this.dropPosition);
			this.targetAnchor = null;
			this.targetBox = null;
			this.dropPosition = null;
		},

		_markDndStatus: function(copy){
			// summary:
			//		Changes source's state based on "copy" status
			this._changeState("Source", copy ? "Copied" : "Moved");
		}
	});

	/*=====
	dndSource.__Item = __Item;
	=====*/

	return dndSource;
});

},
'dijit/Menu':function(){
define([
	"require",
	"dojo/_base/array", // array.forEach
	"dojo/_base/declare", // declare
	"dojo/dom", // dom.byId dom.isDescendant
	"dojo/dom-attr", // domAttr.get domAttr.set domAttr.has domAttr.remove
	"dojo/dom-geometry", // domStyle.getComputedStyle domGeometry.position
	"dojo/dom-style", // domStyle.getComputedStyle
	"dojo/keys", // keys.F10
	"dojo/_base/lang", // lang.hitch
	"dojo/on",
	"dojo/sniff", // has("ie"), has("quirks")
	"dojo/_base/window", // win.body
	"dojo/window", // winUtils.get
	"./popup",
	"./DropDownMenu",
	"dojo/ready"
], function(require, array, declare, dom, domAttr, domGeometry, domStyle, keys, lang, on, has, win, winUtils, pm, DropDownMenu, ready){

	// module:
	//		dijit/Menu

	// Back compat w/1.6, remove for 2.0
	if(has("dijit-legacy-requires")){
		ready(0, function(){
			var requires = ["dijit/MenuItem", "dijit/PopupMenuItem", "dijit/CheckedMenuItem", "dijit/MenuSeparator"];
			require(requires);	// use indirection so modules not rolled into a build
		});
	}

	return declare("dijit.Menu", DropDownMenu, {
		// summary:
		//		A context menu you can assign to multiple elements

		constructor: function(/*===== params, srcNodeRef =====*/){
			// summary:
			//		Create the widget.
			// params: Object|null
			//		Hash of initialization parameters for widget, including scalar values (like title, duration etc.)
			//		and functions, typically callbacks like onClick.
			//		The hash can contain any of the widget's properties, excluding read-only properties.
			// srcNodeRef: DOMNode|String?
			//		If a srcNodeRef (DOM node) is specified:
			//
			//		- use srcNodeRef.innerHTML as my contents
			//		- replace srcNodeRef with my generated DOM tree

			this._bindings = [];
		},

		// targetNodeIds: [const] String[]
		//		Array of dom node ids of nodes to attach to.
		//		Fill this with nodeIds upon widget creation and it becomes context menu for those nodes.
		targetNodeIds: [],

		// selector: String?
		//		CSS expression to apply this Menu to descendants of targetNodeIds, rather than to
		//		the nodes specified by targetNodeIds themselves.    Useful for applying a Menu to
		//		a range of rows in a table, tree, etc.
		//
		//		The application must require() an appropriate level of dojo/query to handle the selector.
		selector: "",

		// TODO: in 2.0 remove support for multiple targetNodeIds.   selector gives the same effect.
		// So, change targetNodeIds to a targetNodeId: "", remove bindDomNode()/unBindDomNode(), etc.

		/*=====
		// currentTarget: [readonly] DOMNode
		//		For context menus, set to the current node that the Menu is being displayed for.
		//		Useful so that the menu actions can be tailored according to the node
		currentTarget: null,
		=====*/

		// contextMenuForWindow: [const] Boolean
		//		If true, right clicking anywhere on the window will cause this context menu to open.
		//		If false, must specify targetNodeIds.
		contextMenuForWindow: false,

		// leftClickToOpen: [const] Boolean
		//		If true, menu will open on left click instead of right click, similar to a file menu.
		leftClickToOpen: false,

		// refocus: Boolean
		//		When this menu closes, re-focus the element which had focus before it was opened.
		refocus: true,

		postCreate: function(){
			if(this.contextMenuForWindow){
				this.bindDomNode(this.ownerDocumentBody);
			}else{
				array.forEach(this.targetNodeIds, this.bindDomNode, this);
			}
			this.inherited(arguments);
		},

		// thanks burstlib!
		_iframeContentWindow: function(/* HTMLIFrameElement */iframe_el){
			// summary:
			//		Returns the window reference of the passed iframe
			// tags:
			//		private
			return winUtils.get(this._iframeContentDocument(iframe_el)) ||
				// Moz. TODO: is this available when defaultView isn't?
				this._iframeContentDocument(iframe_el)['__parent__'] ||
				(iframe_el.name && document.frames[iframe_el.name]) || null;	//	Window
		},

		_iframeContentDocument: function(/* HTMLIFrameElement */iframe_el){
			// summary:
			//		Returns a reference to the document object inside iframe_el
			// tags:
			//		protected
			return iframe_el.contentDocument // W3
				|| (iframe_el.contentWindow && iframe_el.contentWindow.document) // IE
				|| (iframe_el.name && document.frames[iframe_el.name] && document.frames[iframe_el.name].document)
				|| null;	//	HTMLDocument
		},

		bindDomNode: function(/*String|DomNode*/ node){
			// summary:
			//		Attach menu to given node
			node = dom.byId(node, this.ownerDocument);

			var cn;	// Connect node

			// Support context menus on iframes.  Rather than binding to the iframe itself we need
			// to bind to the <body> node inside the iframe.
			if(node.tagName.toLowerCase() == "iframe"){
				var iframe = node,
					window = this._iframeContentWindow(iframe);
				cn = win.body(window.document);
			}else{
				// To capture these events at the top level, attach to <html>, not <body>.
				// Otherwise right-click context menu just doesn't work.
				cn = (node == win.body(this.ownerDocument) ? this.ownerDocument.documentElement : node);
			}


			// "binding" is the object to track our connection to the node (ie, the parameter to bindDomNode())
			var binding = {
				node: node,
				iframe: iframe
			};

			// Save info about binding in _bindings[], and make node itself record index(+1) into
			// _bindings[] array.  Prefix w/_dijitMenu to avoid setting an attribute that may
			// start with a number, which fails on FF/safari.
			domAttr.set(node, "_dijitMenu" + this.id, this._bindings.push(binding));

			// Setup the connections to monitor click etc., unless we are connecting to an iframe which hasn't finished
			// loading yet, in which case we need to wait for the onload event first, and then connect
			// On linux Shift-F10 produces the oncontextmenu event, but on Windows it doesn't, so
			// we need to monitor keyboard events in addition to the oncontextmenu event.
			var doConnects = lang.hitch(this, function(cn){
				var selector = this.selector,
					delegatedEvent = selector ?
						function(eventType){
							return on.selector(selector, eventType);
						} :
						function(eventType){
							return eventType;
						},
					self = this;
				return [
					// TODO: when leftClickToOpen is true then shouldn't space/enter key trigger the menu,
					// rather than shift-F10?
					on(cn, delegatedEvent(this.leftClickToOpen ? "click" : "contextmenu"), function(evt){
						// Schedule context menu to be opened unless it's already been scheduled from onkeydown handler
						evt.stopPropagation();
						evt.preventDefault();
						self._scheduleOpen(this, iframe, {x: evt.pageX, y: evt.pageY});
					}),
					on(cn, delegatedEvent("keydown"), function(evt){
						if(evt.shiftKey && evt.keyCode == keys.F10){
							evt.stopPropagation();
							evt.preventDefault();
							self._scheduleOpen(this, iframe);	// no coords - open near target node
						}
					})
				];
			});
			binding.connects = cn ? doConnects(cn) : [];

			if(iframe){
				// Setup handler to [re]bind to the iframe when the contents are initially loaded,
				// and every time the contents change.
				// Need to do this b/c we are actually binding to the iframe's <body> node.
				// Note: can't use connect.connect(), see #9609.

				binding.onloadHandler = lang.hitch(this, function(){
					// want to remove old connections, but IE throws exceptions when trying to
					// access the <body> node because it's already gone, or at least in a state of limbo

					var window = this._iframeContentWindow(iframe),
						cn = win.body(window.document);
					binding.connects = doConnects(cn);
				});
				if(iframe.addEventListener){
					iframe.addEventListener("load", binding.onloadHandler, false);
				}else{
					iframe.attachEvent("onload", binding.onloadHandler);
				}
			}
		},

		unBindDomNode: function(/*String|DomNode*/ nodeName){
			// summary:
			//		Detach menu from given node

			var node;
			try{
				node = dom.byId(nodeName, this.ownerDocument);
			}catch(e){
				// On IE the dom.byId() call will get an exception if the attach point was
				// the <body> node of an <iframe> that has since been reloaded (and thus the
				// <body> node is in a limbo state of destruction.
				return;
			}

			// node["_dijitMenu" + this.id] contains index(+1) into my _bindings[] array
			var attrName = "_dijitMenu" + this.id;
			if(node && domAttr.has(node, attrName)){
				var bid = domAttr.get(node, attrName) - 1, b = this._bindings[bid], h;
				while((h = b.connects.pop())){
					h.remove();
				}

				// Remove listener for iframe onload events
				var iframe = b.iframe;
				if(iframe){
					if(iframe.removeEventListener){
						iframe.removeEventListener("load", b.onloadHandler, false);
					}else{
						iframe.detachEvent("onload", b.onloadHandler);
					}
				}

				domAttr.remove(node, attrName);
				delete this._bindings[bid];
			}
		},

		_scheduleOpen: function(/*DomNode?*/ target, /*DomNode?*/ iframe, /*Object?*/ coords){
			// summary:
			//		Set timer to display myself.  Using a timer rather than displaying immediately solves
			//		two problems:
			//
			//		1. IE: without the delay, focus work in "open" causes the system
			//		context menu to appear in spite of stopEvent.
			//
			//		2. Avoid double-shows on linux, where shift-F10 generates an oncontextmenu event
			//		even after a evt.preventDefault().  (Shift-F10 on windows doesn't generate the
			//		oncontextmenu event.)

			if(!this._openTimer){
				this._openTimer = this.defer(function(){
					delete this._openTimer;
					this._openMyself({
						target: target,
						iframe: iframe,
						coords: coords
					});
				}, 1);
			}
		},

		_openMyself: function(args){
			// summary:
			//		Internal function for opening myself when the user does a right-click or something similar.
			// args:
			//		This is an Object containing:
			//
			//		- target: The node that is being clicked
			//		- iframe: If an `<iframe>` is being clicked, iframe points to that iframe
			//		- coords: Put menu at specified x/y position in viewport, or if iframe is
			//		  specified, then relative to iframe.
			//
			//		_openMyself() formerly took the event object, and since various code references
			//		evt.target (after connecting to _openMyself()), using an Object for parameters
			//		(so that old code still works).

			var target = args.target,
				iframe = args.iframe,
				coords = args.coords,
				byKeyboard = !coords;

			// To be used by MenuItem event handlers to tell which node the menu was opened on
			this.currentTarget = target;

			// Get coordinates to open menu, either at specified (mouse) position or (if triggered via keyboard)
			// then near the node the menu is assigned to.
			if(coords){
				if(iframe){
					// Specified coordinates are on <body> node of an <iframe>, convert to match main document
					var ifc = domGeometry.position(iframe, true),
						window = this._iframeContentWindow(iframe),
						scroll = domGeometry.docScroll(window.document);

					var cs = domStyle.getComputedStyle(iframe),
						tp = domStyle.toPixelValue,
						left = (has("ie") && has("quirks") ? 0 : tp(iframe, cs.paddingLeft)) + (has("ie") && has("quirks") ? tp(iframe, cs.borderLeftWidth) : 0),
						top = (has("ie") && has("quirks") ? 0 : tp(iframe, cs.paddingTop)) + (has("ie") && has("quirks") ? tp(iframe, cs.borderTopWidth) : 0);

					coords.x += ifc.x + left - scroll.x;
					coords.y += ifc.y + top - scroll.y;
				}
			}else{
				coords = domGeometry.position(target, true);
				coords.x += 10;
				coords.y += 10;
			}

			var self = this;
			var prevFocusNode = this._focusManager.get("prevNode");
			var curFocusNode = this._focusManager.get("curNode");
			var savedFocusNode = !curFocusNode || (dom.isDescendant(curFocusNode, this.domNode)) ? prevFocusNode : curFocusNode;

			function closeAndRestoreFocus(){
				// user has clicked on a menu or popup
				if(self.refocus && savedFocusNode){
					savedFocusNode.focus();
				}
				pm.close(self);
			}

			pm.open({
				popup: this,
				x: coords.x,
				y: coords.y,
				onExecute: closeAndRestoreFocus,
				onCancel: closeAndRestoreFocus,
				orient: this.isLeftToRight() ? 'L' : 'R'
			});

			// Focus the menu even when opened by mouse, so that a click on blank area of screen will close it
			this.focus();
			if(!byKeyboard){
				// But then (when opened by mouse), mark Menu as passive, so that the first item isn't highlighted.
				// On IE9+ this needs to be on a delay because the focus is asynchronous.
				this.defer(function(){
					this._cleanUp(true);
				});
			}

			this._onBlur = function(){
				this.inherited('_onBlur', arguments);
				// Usually the parent closes the child widget but if this is a context
				// menu then there is no parent
				pm.close(this);
				// don't try to restore focus; user has clicked another part of the screen
				// and set focus there
			};
		},

		destroy: function(){
			array.forEach(this._bindings, function(b){
				if(b){
					this.unBindDomNode(b.node);
				}
			}, this);
			this.inherited(arguments);
		}
	});
});

},
'dijit/layout/TabContainer':function(){
define([
	"dojo/_base/lang", // lang.getObject
	"dojo/_base/declare", // declare
	"./_TabContainerBase",
	"./TabController",
	"./ScrollingTabController"
], function(lang, declare, _TabContainerBase, TabController, ScrollingTabController){

	// module:
	//		dijit/layout/TabContainer


	return declare("dijit.layout.TabContainer", _TabContainerBase, {
		// summary:
		//		A Container with tabs to select each child (only one of which is displayed at a time).
		// description:
		//		A TabContainer is a container that has multiple panes, but shows only
		//		one pane at a time.  There are a set of tabs corresponding to each pane,
		//		where each tab has the name (aka title) of the pane, and optionally a close button.
		//
		//		See `StackContainer.ChildWidgetProperties` for details on the properties that can be set on
		//		children of a `TabContainer`.

		// useMenu: [const] Boolean
		//		True if a menu should be used to select tabs when they are too
		//		wide to fit the TabContainer, false otherwise.
		useMenu: true,

		// useSlider: [const] Boolean
		//		True if a slider should be used to select tabs when they are too
		//		wide to fit the TabContainer, false otherwise.
		useSlider: true,

		// controllerWidget: Class
		//		An optional parameter to override the widget used to display the tab labels
		controllerWidget: "",

		_makeController: function(/*DomNode*/ srcNode){
			// summary:
			//		Instantiate tablist controller widget and return reference to it.
			//		Callback from _TabContainerBase.postCreate().
			// tags:
			//		protected extension

			// "string" branch for back-compat, remove for 2.0
			var cls = this.baseClass + "-tabs" + (this.doLayout ? "" : " dijitTabNoLayout"),
				TabController = typeof this.controllerWidget == "string" ? lang.getObject(this.controllerWidget) :
						this.controllerWidget;

			return new TabController({
				id: this.id + "_tablist",
				ownerDocument: this.ownerDocument,
				dir: this.dir,
				lang: this.lang,
				textDir: this.textDir,
				tabPosition: this.tabPosition,
				doLayout: this.doLayout,
				containerId: this.id,
				"class": cls,
				nested: this.nested,
				useMenu: this.useMenu,
				useSlider: this.useSlider,
				tabStripClass: this.tabStrip ? this.baseClass + (this.tabStrip ? "":"No") + "Strip": null
			}, srcNode);
		},

		postMixInProperties: function(){
			this.inherited(arguments);

			// Scrolling controller only works for horizontal non-nested tabs
			if(!this.controllerWidget){
				this.controllerWidget = (this.tabPosition == "top" || this.tabPosition == "bottom") && !this.nested ?
							ScrollingTabController : TabController;
			}
		}
	});
});

},
'dijit/layout/_TabContainerBase':function(){
define([
	"dojo/text!./templates/TabContainer.html",
	"./StackContainer",
	"./utils", // marginBox2contextBox, layoutChildren
	"../_TemplatedMixin",
	"dojo/_base/declare", // declare
	"dojo/dom-class", // domClass.add
	"dojo/dom-geometry", // domGeometry.contentBox
	"dojo/dom-style" // domStyle.style
], function(template, StackContainer, layoutUtils, _TemplatedMixin, declare, domClass, domGeometry, domStyle){

	// module:
	//		dijit/layout/_TabContainerBase

	return declare("dijit.layout._TabContainerBase", [StackContainer, _TemplatedMixin], {
		// summary:
		//		Abstract base class for TabContainer.   Must define _makeController() to instantiate
		//		and return the widget that displays the tab labels
		// description:
		//		A TabContainer is a container that has multiple panes, but shows only
		//		one pane at a time.  There are a set of tabs corresponding to each pane,
		//		where each tab has the name (aka title) of the pane, and optionally a close button.

		// tabPosition: String
		//		Defines where tabs go relative to tab content.
		//		"top", "bottom", "left-h", "right-h"
		tabPosition: "top",

		baseClass: "dijitTabContainer",

		// tabStrip: [const] Boolean
		//		Defines whether the tablist gets an extra class for layouting, putting a border/shading
		//		around the set of tabs.   Not supported by claro theme.
		tabStrip: false,

		// nested: [const] Boolean
		//		If true, use styling for a TabContainer nested inside another TabContainer.
		//		For tundra etc., makes tabs look like links, and hides the outer
		//		border since the outer TabContainer already has a border.
		nested: false,

		templateString: template,

		postMixInProperties: function(){
			// set class name according to tab position, ex: dijitTabContainerTop
			this.baseClass += this.tabPosition.charAt(0).toUpperCase() + this.tabPosition.substr(1).replace(/-.*/, "");

			this.srcNodeRef && domStyle.set(this.srcNodeRef, "visibility", "hidden");

			this.inherited(arguments);
		},

		buildRendering: function(){
			this.inherited(arguments);

			// Create the tab list that will have a tab (a.k.a. tab button) for each tab panel
			this.tablist = this._makeController(this.tablistNode);

			if(!this.doLayout){
				domClass.add(this.domNode, "dijitTabContainerNoLayout");
			}

			if(this.nested){
				/* workaround IE's lack of support for "a > b" selectors by
				 * tagging each node in the template.
				 */
				domClass.add(this.domNode, "dijitTabContainerNested");
				domClass.add(this.tablist.containerNode, "dijitTabContainerTabListNested");
				domClass.add(this.tablistSpacer, "dijitTabContainerSpacerNested");
				domClass.add(this.containerNode, "dijitTabPaneWrapperNested");
			}else{
				domClass.add(this.domNode, "tabStrip-" + (this.tabStrip ? "enabled" : "disabled"));
			}
		},

		_setupChild: function(/*dijit/_WidgetBase*/ tab){
			// Overrides StackContainer._setupChild().
			domClass.add(tab.domNode, "dijitTabPane");
			this.inherited(arguments);
		},

		startup: function(){
			if(this._started){
				return;
			}

			// wire up the tablist and its tabs
			this.tablist.startup();

			this.inherited(arguments);
		},

		layout: function(){
			// Overrides StackContainer.layout().
			// Configure the content pane to take up all the space except for where the tabs are

			if(!this._contentBox || typeof(this._contentBox.l) == "undefined"){
				return;
			}

			var sc = this.selectedChildWidget;

			if(this.doLayout){
				// position and size the titles and the container node
				var titleAlign = this.tabPosition.replace(/-h/, "");
				this.tablist.region = titleAlign;
				var children = [this.tablist, {
					domNode: this.tablistSpacer,
					region: titleAlign
				}, {
					domNode: this.containerNode,
					region: "center"
				}];
				layoutUtils.layoutChildren(this.domNode, this._contentBox, children);

				// Compute size to make each of my children.
				// children[2] is the margin-box size of this.containerNode, set by layoutChildren() call above
				this._containerContentBox = layoutUtils.marginBox2contentBox(this.containerNode, children[2]);

				if(sc && sc.resize){
					sc.resize(this._containerContentBox);
				}
			}else{
				// just layout the tab controller, so it can position left/right buttons etc.
				if(this.tablist.resize){
					//make the tabs zero width so that they don't interfere with width calc, then reset
					var s = this.tablist.domNode.style;
					s.width = "0";
					var width = domGeometry.getContentBox(this.domNode).w;
					s.width = "";
					this.tablist.resize({w: width});
				}

				// and call resize() on the selected pane just to tell it that it's been made visible
				if(sc && sc.resize){
					sc.resize();
				}
			}
		},

		destroy: function(preserveDom){
			if(this.tablist){
				this.tablist.destroy(preserveDom);
			}
			this.inherited(arguments);
		}
	});
});

},
'dijit/layout/StackContainer':function(){
define([
	"dojo/_base/array", // array.forEach array.indexOf array.some
	"dojo/cookie", // cookie
	"dojo/_base/declare", // declare
	"dojo/dom-class", // domClass.add domClass.replace
	"dojo/dom-construct",
	"dojo/has", // has("dijit-legacy-requires")
	"dojo/_base/lang", // lang.extend
	"dojo/on",
	"dojo/ready",
	"dojo/topic", // publish
	"dojo/when",
	"../registry", // registry.byId
	"../_WidgetBase",
	"./_LayoutWidget",
	"dojo/i18n!../nls/common"
], function(array, cookie, declare, domClass, domConstruct, has, lang, on, ready, topic, when, registry, _WidgetBase, _LayoutWidget){

	// module:
	//		dijit/layout/StackContainer

	// Back compat w/1.6, remove for 2.0
	if(has("dijit-legacy-requires")){
		ready(0, function(){
			var requires = ["dijit/layout/StackController"];
			require(requires);	// use indirection so modules not rolled into a build
		});
	}

	var StackContainer = declare("dijit.layout.StackContainer", _LayoutWidget, {
		// summary:
		//		A container that has multiple children, but shows only
		//		one child at a time
		//
		// description:
		//		A container for widgets (ContentPanes, for example) That displays
		//		only one Widget at a time.
		//
		//		Publishes topics [widgetId]-addChild, [widgetId]-removeChild, and [widgetId]-selectChild
		//
		//		Can be base class for container, Wizard, Show, etc.
		//
		//		See `StackContainer.ChildWidgetProperties` for details on the properties that can be set on
		//		children of a `StackContainer`.

		// doLayout: Boolean
		//		If true, change the size of my currently displayed child to match my size
		doLayout: true,

		// persist: Boolean
		//		Remembers the selected child across sessions
		persist: false,

		baseClass: "dijitStackContainer",

		/*=====
		// selectedChildWidget: [readonly] dijit._Widget
		//		References the currently selected child widget, if any.
		//		Adjust selected child with selectChild() method.
		selectedChildWidget: null,
		=====*/

		buildRendering: function(){
			this.inherited(arguments);
			domClass.add(this.domNode, "dijitLayoutContainer");
		},

		postCreate: function(){
			this.inherited(arguments);
			this.own(
				on(this.domNode, "keydown", lang.hitch(this, "_onKeyDown"))
			);
		},

		startup: function(){
			if(this._started){
				return;
			}

			var children = this.getChildren();

			// Setup each page panel to be initially hidden
			array.forEach(children, this._setupChild, this);

			// Figure out which child to initially display, defaulting to first one
			if(this.persist){
				this.selectedChildWidget = registry.byId(cookie(this.id + "_selectedChild"));
			}else{
				array.some(children, function(child){
					if(child.selected){
						this.selectedChildWidget = child;
					}
					return child.selected;
				}, this);
			}
			var selected = this.selectedChildWidget;
			if(!selected && children[0]){
				selected = this.selectedChildWidget = children[0];
				selected.selected = true;
			}

			// Publish information about myself so any StackControllers can initialize.
			// This needs to happen before this.inherited(arguments) so that for
			// TabContainer, this._contentBox doesn't include the space for the tab labels.
			topic.publish(this.id + "-startup", {children: children, selected: selected, textDir: this.textDir});

			// Startup each child widget, and do initial layout like setting this._contentBox,
			// then calls this.resize() which does the initial sizing on the selected child.
			this.inherited(arguments);
		},

		resize: function(){
			// Overrides _LayoutWidget.resize()
			// Resize is called when we are first made visible (it's called from startup()
			// if we are initially visible). If this is the first time we've been made
			// visible then show our first child.
			if(!this._hasBeenShown){
				this._hasBeenShown = true;
				var selected = this.selectedChildWidget;
				if(selected){
					this._showChild(selected);
				}
			}
			this.inherited(arguments);
		},

		_setupChild: function(/*dijit/_WidgetBase*/ child){
			// Overrides _LayoutWidget._setupChild()

			// For aria support, wrap child widget in a <div role="tabpanel">
			var childNode = child.domNode,
				wrapper = domConstruct.place(
					"<div role='tabpanel' class='" + this.baseClass + "ChildWrapper dijitHidden'>",
					child.domNode,
					"replace"),
				label = child["aria-label"] || child.title || child.label;
			if(label){
				// setAttribute() escapes special chars, and if() statement avoids setting aria-label="undefined"
				wrapper.setAttribute("aria-label", label);
			}
			domConstruct.place(childNode, wrapper);
			child._wrapper = wrapper;	// to set the aria-labelledby in StackController

			this.inherited(arguments);

			// child may have style="display: none" (at least our test cases do), so remove that
			if(childNode.style.display == "none"){
				childNode.style.display = "block";
			}

			// remove the title attribute so it doesn't show up when i hover over a node
			child.domNode.title = "";
		},

		addChild: function(/*dijit/_WidgetBase*/ child, /*Integer?*/ insertIndex){
			// Overrides _Container.addChild() to do layout and publish events

			this.inherited(arguments);

			if(this._started){
				topic.publish(this.id + "-addChild", child, insertIndex);	// publish

				// in case the tab titles have overflowed from one line to two lines
				// (or, if this if first child, from zero lines to one line)
				// TODO: w/ScrollingTabController this is no longer necessary, although
				// ScrollTabController.resize() does need to get called to show/hide
				// the navigation buttons as appropriate, but that's handled in ScrollingTabController.onAddChild().
				// If this is updated to not layout [except for initial child added / last child removed], update
				// "childless startup" test in StackContainer.html to check for no resize event after second addChild()
				this.layout();

				// if this is the first child, then select it
				if(!this.selectedChildWidget){
					this.selectChild(child);
				}
			}
		},

		removeChild: function(/*dijit/_WidgetBase*/ page){
			// Overrides _Container.removeChild() to do layout and publish events

			var idx = array.indexOf(this.getChildren(), page);

			this.inherited(arguments);

			// Remove the child widget wrapper we use to set aria roles.  This won't affect the page itself since it's
			// already been detached from page._wrapper via the this.inherited(arguments) call above.
			domConstruct.destroy(page._wrapper);
			delete page._wrapper;

			if(this._started){
				// This will notify any tablists to remove a button; do this first because it may affect sizing.
				topic.publish(this.id + "-removeChild", page);
			}

			// If all our children are being destroyed than don't run the code below (to select another page),
			// because we are deleting every page one by one
			if(this._descendantsBeingDestroyed){
				return;
			}

			// Select new page to display, also updating TabController to show the respective tab.
			// Do this before layout call because it can affect the height of the TabController.
			if(this.selectedChildWidget === page){
				this.selectedChildWidget = undefined;
				if(this._started){
					var children = this.getChildren();
					if(children.length){
						this.selectChild(children[Math.max(idx - 1, 0)]);
					}
				}
			}

			if(this._started){
				// In case the tab titles now take up one line instead of two lines
				// (note though that ScrollingTabController never overflows to multiple lines),
				// or the height has changed slightly because of addition/removal of tab which close icon
				this.layout();
			}
		},

		selectChild: function(/*dijit/_WidgetBase|String*/ page, /*Boolean*/ animate){
			// summary:
			//		Show the given widget (which must be one of my children)
			// page:
			//		Reference to child widget or id of child widget

			var d;

			page = registry.byId(page);

			if(this.selectedChildWidget != page){
				// Deselect old page and select new one
				d = this._transition(page, this.selectedChildWidget, animate);
				this._set("selectedChildWidget", page);
				topic.publish(this.id + "-selectChild", page);	// publish

				if(this.persist){
					cookie(this.id + "_selectedChild", this.selectedChildWidget.id);
				}
			}

			// d may be null, or a scalar like true.  Return a promise in all cases
			return when(d || true);		// Promise
		},

		_transition: function(newWidget, oldWidget /*===== ,  animate =====*/){
			// summary:
			//		Hide the old widget and display the new widget.
			//		Subclasses should override this.
			// newWidget: dijit/_WidgetBase
			//		The newly selected widget.
			// oldWidget: dijit/_WidgetBase
			//		The previously selected widget.
			// animate: Boolean
			//		Used by AccordionContainer to turn on/off slide effect.
			// tags:
			//		protected extension
			if(oldWidget){
				this._hideChild(oldWidget);
			}
			var d = this._showChild(newWidget);

			// Size the new widget, in case this is the first time it's being shown,
			// or I have been resized since the last time it was shown.
			// Note that page must be visible for resizing to work.
			if(newWidget.resize){
				if(this.doLayout){
					newWidget.resize(this._containerContentBox || this._contentBox);
				}else{
					// the child should pick it's own size but we still need to call resize()
					// (with no arguments) to let the widget lay itself out
					newWidget.resize();
				}
			}

			return d;	// If child has an href, promise that fires when the child's href finishes loading
		},

		_adjacent: function(/*Boolean*/ forward){
			// summary:
			//		Gets the next/previous child widget in this container from the current selection.

			// TODO: remove for 2.0 if this isn't being used.   Otherwise, fix to skip disabled tabs.

			var children = this.getChildren();
			var index = array.indexOf(children, this.selectedChildWidget);
			index += forward ? 1 : children.length - 1;
			return children[ index % children.length ]; // dijit/_WidgetBase
		},

		forward: function(){
			// summary:
			//		Advance to next page.
			return this.selectChild(this._adjacent(true), true);
		},

		back: function(){
			// summary:
			//		Go back to previous page.
			return this.selectChild(this._adjacent(false), true);
		},

		_onKeyDown: function(e){
			topic.publish(this.id + "-containerKeyDown", { e: e, page: this});	// publish
		},

		layout: function(){
			// Implement _LayoutWidget.layout() virtual method.
			var child = this.selectedChildWidget;
			if(child && child.resize){
				if(this.doLayout){
					child.resize(this._containerContentBox || this._contentBox);
				}else{
					child.resize();
				}
			}
		},

		_showChild: function(/*dijit/_WidgetBase*/ page){
			// summary:
			//		Show the specified child by changing it's CSS, and call _onShow()/onShow() so
			//		it can do any updates it needs regarding loading href's etc.
			// returns:
			//		Promise that fires when page has finished showing, or true if there's no href
			var children = this.getChildren();
			page.isFirstChild = (page == children[0]);
			page.isLastChild = (page == children[children.length - 1]);
			page._set("selected", true);

			if(page._wrapper){	// false if not started yet
				domClass.replace(page._wrapper, "dijitVisible", "dijitHidden");
			}

			return (page._onShow && page._onShow()) || true;
		},

		_hideChild: function(/*dijit/_WidgetBase*/ page){
			// summary:
			//		Hide the specified child by changing it's CSS, and call _onHide() so
			//		it's notified.
			page._set("selected", false);

			if(page._wrapper){	// false if not started yet
				domClass.replace(page._wrapper, "dijitHidden", "dijitVisible");
			}

			page.onHide && page.onHide();
		},

		closeChild: function(/*dijit/_WidgetBase*/ page){
			// summary:
			//		Callback when user clicks the [X] to remove a page.
			//		If onClose() returns true then remove and destroy the child.
			// tags:
			//		private
			var remove = page.onClose && page.onClose(this, page);
			if(remove){
				this.removeChild(page);
				// makes sure we can clean up executeScripts in ContentPane onUnLoad
				page.destroyRecursive();
			}
		},

		destroyDescendants: function(/*Boolean*/ preserveDom){
			this._descendantsBeingDestroyed = true;
			this.selectedChildWidget = undefined;
			array.forEach(this.getChildren(), function(child){
				if(!preserveDom){
					this.removeChild(child);
				}
				child.destroyRecursive(preserveDom);
			}, this);
			this._descendantsBeingDestroyed = false;
		}
	});

	StackContainer.ChildWidgetProperties = {
		// summary:
		//		These properties can be specified for the children of a StackContainer.

		// selected: Boolean
		//		Specifies that this widget should be the initially displayed pane.
		//		Note: to change the selected child use `dijit/layout/StackContainer.selectChild`
		selected: false,

		// disabled: Boolean
		//		Specifies that the button to select this pane should be disabled.
		//		Doesn't affect programmatic selection of the pane, nor does it deselect the pane if it is currently selected.
		disabled: false,

		// closable: Boolean
		//		True if user can close (destroy) this child, such as (for example) clicking the X on the tab.
		closable: false,

		// iconClass: String
		//		CSS Class specifying icon to use in label associated with this pane.
		iconClass: "dijitNoIcon",

		// showTitle: Boolean
		//		When true, display title of this widget as tab label etc., rather than just using
		//		icon specified in iconClass
		showTitle: true
	};

	// Since any widget can be specified as a StackContainer child, mix them
	// into the base widget class.  (This is a hack, but it's effective.)
	// This is for the benefit of the parser.   Remove for 2.0.  Also, hide from doc viewer.
	lang.extend(_WidgetBase, /*===== {} || =====*/ StackContainer.ChildWidgetProperties);

	return StackContainer;
});

},
'dijit/layout/TabController':function(){
define([
	"dojo/_base/declare", // declare
	"dojo/dom", // dom.setSelectable
	"dojo/dom-attr", // domAttr.attr
	"dojo/dom-class", // domClass.toggle
	"dojo/has",
	"dojo/i18n", // i18n.getLocalization
	"dojo/_base/lang", // lang.hitch lang.trim
	"./StackController",
	"../registry",
	"../Menu",
	"../MenuItem",
	"dojo/text!./templates/_TabButton.html",
	"dojo/i18n!../nls/common"
], function(declare, dom, domAttr, domClass, has, i18n, lang, StackController, registry, Menu, MenuItem, template){

	// module:
	//		dijit/layout/TabController

	var TabButton = declare("dijit.layout._TabButton" + (has("dojo-bidi") ? "_NoBidi" : ""), StackController.StackButton, {
		// summary:
		//		A tab (the thing you click to select a pane).
		// description:
		//		Contains the title of the pane, and optionally a close-button to destroy the pane.
		//		This is an internal widget and should not be instantiated directly.
		// tags:
		//		private

		// baseClass: String
		//		The CSS class applied to the domNode.
		baseClass: "dijitTab",

		// Apply dijitTabCloseButtonHover when close button is hovered
		cssStateNodes: {
			closeNode: "dijitTabCloseButton"
		},

		templateString: template,

		// Button superclass maps name to a this.valueNode, but we don't have a this.valueNode attach point
		_setNameAttr: "focusNode",

		// Override _FormWidget.scrollOnFocus.
		// Don't scroll the whole tab container into view when the button is focused.
		scrollOnFocus: false,

		buildRendering: function(){
			this.inherited(arguments);

			dom.setSelectable(this.containerNode, false);
		},

		startup: function(){
			this.inherited(arguments);
			var n = this.domNode;

			// Required to give IE6 a kick, as it initially hides the
			// tabs until they are focused on.
			this.defer(function(){
				n.className = n.className;
			}, 1);
		},

		_setCloseButtonAttr: function(/*Boolean*/ disp){
			// summary:
			//		Hide/show close button
			this._set("closeButton", disp);
			domClass.toggle(this.domNode, "dijitClosable", disp);
			this.closeNode.style.display = disp ? "" : "none";
			if(disp){
				var _nlsResources = i18n.getLocalization("dijit", "common");
				if(this.closeNode){
					domAttr.set(this.closeNode, "title", _nlsResources.itemClose);
				}
			}
		},

		_setDisabledAttr: function(/*Boolean*/ disabled){
			// summary:
			//		Make tab selected/unselectable

			this.inherited(arguments);

			// Don't show tooltip for close button when tab is disabled
			if(this.closeNode){
				if(disabled){
					domAttr.remove(this.closeNode, "title");
				}else{
					var _nlsResources = i18n.getLocalization("dijit", "common");
					domAttr.set(this.closeNode, "title", _nlsResources.itemClose);
				}
			}
		},

		_setLabelAttr: function(/*String*/ content){
			// summary:
			//		Hook for set('label', ...) to work.
			// description:
			//		takes an HTML string.
			//		Inherited ToggleButton implementation will Set the label (text) of the button;
			//		Need to set the alt attribute of icon on tab buttons if no label displayed
			this.inherited(arguments);
			if(!this.showLabel && !this.params.title){
				this.iconNode.alt = lang.trim(this.containerNode.innerText || this.containerNode.textContent || '');
			}
		}
	});

	if(has("dojo-bidi")){
		TabButton = declare("dijit.layout._TabButton", TabButton, {
			_setLabelAttr: function(/*String*/ content){
				this.inherited(arguments);
				this.applyTextDir(this.iconNode, this.iconNode.alt);
			}
		});
	}

	var TabController = declare("dijit.layout.TabController", StackController, {
		// summary:
		//		Set of tabs (the things with titles and a close button, that you click to show a tab panel).
		//		Used internally by `dijit/layout/TabContainer`.
		// description:
		//		Lets the user select the currently shown pane in a TabContainer or StackContainer.
		//		TabController also monitors the TabContainer, and whenever a pane is
		//		added or deleted updates itself accordingly.
		// tags:
		//		private

		baseClass: "dijitTabController",

		templateString: "<div role='tablist' data-dojo-attach-event='onkeydown:onkeydown'></div>",

		// tabPosition: String
		//		Defines where tabs go relative to the content.
		//		"top", "bottom", "left-h", "right-h"
		tabPosition: "top",

		// buttonWidget: Constructor
		//		The tab widget to create to correspond to each page
		buttonWidget: TabButton,

		// buttonWidgetCloseClass: String
		//		Class of [x] close icon, used by event delegation code to tell when close button was clicked
		buttonWidgetCloseClass: "dijitTabCloseButton",

		postCreate: function(){
			this.inherited(arguments);

			// Setup a close menu to be shared between all the closable tabs (excluding disabled tabs)
			var closeMenu = new Menu({
				id: this.id + "_Menu",
				ownerDocument: this.ownerDocument,
				dir: this.dir,
				lang: this.lang,
				textDir: this.textDir,
				targetNodeIds: [this.domNode],
				selector: function(node){
					return domClass.contains(node, "dijitClosable") && !domClass.contains(node, "dijitTabDisabled");
				}
			});
			this.own(closeMenu);

			var _nlsResources = i18n.getLocalization("dijit", "common"),
				controller = this;
			closeMenu.addChild(new MenuItem({
				label: _nlsResources.itemClose,
				ownerDocument: this.ownerDocument,
				dir: this.dir,
				lang: this.lang,
				textDir: this.textDir,
				onClick: function(evt){
					var button = registry.byNode(this.getParent().currentTarget);
					controller.onCloseButtonClick(button.page);
				}
			}));
		}
	});

	TabController.TabButton = TabButton;	// for monkey patching

	return TabController;
});

},
'dijit/layout/StackController':function(){
define([
	"dojo/_base/array", // array.forEach array.indexOf array.map
	"dojo/_base/declare", // declare
	"dojo/dom-class",
	"dojo/dom-construct",
	"dojo/keys", // keys
	"dojo/_base/lang", // lang.getObject
	"dojo/on",
	"dojo/topic",
	"../focus", // focus.focus()
	"../registry", // registry.byId
	"../_Widget",
	"../_TemplatedMixin",
	"../_Container",
	"../form/ToggleButton",
	"dojo/touch",	// for normalized click handling, see dojoClick property setting in postCreate()
	"dojo/i18n!../nls/common"
], function(array, declare, domClass, domConstruct, keys, lang, on, topic, focus, registry, _Widget, _TemplatedMixin, _Container, ToggleButton){

	// module:
	//		dijit/layout/StackController

	var StackButton = declare("dijit.layout._StackButton", ToggleButton, {
		// summary:
		//		Internal widget used by StackContainer.
		// description:
		//		The button-like or tab-like object you click to select or delete a page
		// tags:
		//		private

		// Override _FormWidget.tabIndex.
		// StackContainer buttons are not in the tab order by default.
		// Probably we should be calling this.startupKeyNavChildren() instead.
		tabIndex: "-1",

		// closeButton: Boolean
		//		When true, display close button for this tab
		closeButton: false,

		_aria_attr: "aria-selected",

		buildRendering: function(/*Event*/ evt){
			this.inherited(arguments);
			(this.focusNode || this.domNode).setAttribute("role", "tab");
		}
	});


	var StackController = declare("dijit.layout.StackController", [_Widget, _TemplatedMixin, _Container], {
		// summary:
		//		Set of buttons to select a page in a `dijit/layout/StackContainer`
		// description:
		//		Monitors the specified StackContainer, and whenever a page is
		//		added, deleted, or selected, updates itself accordingly.

		baseClass: "dijitStackController",

		templateString: "<span role='tablist' data-dojo-attach-event='onkeydown'></span>",

		// containerId: [const] String
		//		The id of the page container that I point to
		containerId: "",

		// buttonWidget: [const] Constructor
		//		The button widget to create to correspond to each page
		buttonWidget: StackButton,

		// buttonWidgetCloseClass: String
		//		CSS class of [x] close icon, used by event delegation code to tell when close button was clicked
		buttonWidgetCloseClass: "dijitStackCloseButton",

		pane2button: function(/*String*/ id){
			// summary:
			//		Returns the button corresponding to the pane w/the given id.
			// tags:
			//		protected
			return registry.byId(this.id + "_" + id);
		},

		postCreate: function(){
			this.inherited(arguments);

			// Listen to notifications from StackContainer.  This is tricky because the StackContainer may not have
			// been created yet, so abstracting it through topics.
			// Note: for TabContainer we can do this through bubbled events instead of topics; maybe that's
			// all we support for 2.0?
			this.own(
				topic.subscribe(this.containerId + "-startup", lang.hitch(this, "onStartup")),
				topic.subscribe(this.containerId + "-addChild", lang.hitch(this, "onAddChild")),
				topic.subscribe(this.containerId + "-removeChild", lang.hitch(this, "onRemoveChild")),
				topic.subscribe(this.containerId + "-selectChild", lang.hitch(this, "onSelectChild")),
				topic.subscribe(this.containerId + "-containerKeyDown", lang.hitch(this, "onContainerKeyDown"))
			);

			// Listen for click events to select or close tabs.
			// No need to worry about ENTER/SPACE key handling: tabs are selected via left/right arrow keys,
			// and closed via shift-F10 (to show the close menu).
			// Also, add flag to use normalized click handling from dojo/touch
			this.containerNode.dojoClick = true;
			this.own(on(this.containerNode, 'click', lang.hitch(this, function(evt){
				var button = registry.getEnclosingWidget(evt.target);
				if(button != this.containerNode && !button.disabled && button.page){
					for(var target = evt.target; target !== this.containerNode; target = target.parentNode){
						if(domClass.contains(target, this.buttonWidgetCloseClass)){
							this.onCloseButtonClick(button.page);
							break;
						}else if(target == button.domNode){
							this.onButtonClick(button.page);
							break;
						}
					}
				}
			})));
		},

		onStartup: function(/*Object*/ info){
			// summary:
			//		Called after StackContainer has finished initializing
			// tags:
			//		private
			this.textDir = info.textDir;
			array.forEach(info.children, this.onAddChild, this);
			if(info.selected){
				// Show button corresponding to selected pane (unless selected
				// is null because there are no panes)
				this.onSelectChild(info.selected);
			}

			// Reflect events like page title changes to tab buttons
			var containerNode = registry.byId(this.containerId).containerNode,
				pane2button = lang.hitch(this, "pane2button"),
				paneToButtonAttr = {
					"title": "label",
					"showtitle": "showLabel",
					"iconclass": "iconClass",
					"closable": "closeButton",
					"tooltip": "title",
					"disabled": "disabled",
					"textdir": "textdir"
				},
				connectFunc = function(attr, buttonAttr){
					return on(containerNode, "attrmodified-" + attr, function(evt){
						var button = pane2button(evt.detail && evt.detail.widget && evt.detail.widget.id);
						if(button){
							button.set(buttonAttr, evt.detail.newValue);
						}
					});
				};
			for(var attr in paneToButtonAttr){
				this.own(connectFunc(attr, paneToButtonAttr[attr]));
			}
		},

		destroy: function(preserveDom){
			// Since the buttons are internal to the StackController widget, destroy() should remove them.
			// When #5796 is fixed for 2.0 can get rid of this function completely.
			this.destroyDescendants(preserveDom);
			this.inherited(arguments);
		},

		onAddChild: function(/*dijit/_WidgetBase*/ page, /*Integer?*/ insertIndex){
			// summary:
			//		Called whenever a page is added to the container.
			//		Create button corresponding to the page.
			// tags:
			//		private

			// create an instance of the button widget
			// (remove typeof buttonWidget == string support in 2.0)
			var Cls = lang.isString(this.buttonWidget) ? lang.getObject(this.buttonWidget) : this.buttonWidget;
			var button = new Cls({
				id: this.id + "_" + page.id,
				name: this.id + "_" + page.id, // note: must match id used in pane2button()
				label: page.title,
				disabled: page.disabled,
				ownerDocument: this.ownerDocument,
				dir: page.dir,
				lang: page.lang,
				textDir: page.textDir || this.textDir,
				showLabel: page.showTitle,
				iconClass: page.iconClass,
				closeButton: page.closable,
				title: page.tooltip,
				page: page
			});

			this.addChild(button, insertIndex);
			page.controlButton = button;	// this value might be overwritten if two tabs point to same container
			if(!this._currentChild){
				// If this is the first child then StackContainer will soon publish that it's selected,
				// but before that StackContainer calls layout(), and before layout() is called the
				// StackController needs to have the proper height... which means that the button needs
				// to be marked as selected now.   See test_TabContainer_CSS.html for test.
				this.onSelectChild(page);
			}

			// Add this StackController button to the list of things that labels that StackContainer pane.
			// Also, if there's an aria-labelledby parameter for the pane, then the aria-label parameter is unneeded.
			var labelledby = page._wrapper.getAttribute("aria-labelledby") ?
				page._wrapper.getAttribute("aria-labelledby") + " " + button.id : button.id;
			page._wrapper.removeAttribute("aria-label");
			page._wrapper.setAttribute("aria-labelledby", labelledby);
		},

		onRemoveChild: function(/*dijit/_WidgetBase*/ page){
			// summary:
			//		Called whenever a page is removed from the container.
			//		Remove the button corresponding to the page.
			// tags:
			//		private

			if(this._currentChild === page){
				this._currentChild = null;
			}

			var button = this.pane2button(page.id);
			if(button){
				this.removeChild(button);
				button.destroy();
			}
			delete page.controlButton;
		},

		onSelectChild: function(/*dijit/_WidgetBase*/ page){
			// summary:
			//		Called when a page has been selected in the StackContainer, either by me or by another StackController
			// tags:
			//		private

			if(!page){
				return;
			}

			if(this._currentChild){
				var oldButton = this.pane2button(this._currentChild.id);
				oldButton.set('checked', false);
				oldButton.focusNode.setAttribute("tabIndex", "-1");
			}

			var newButton = this.pane2button(page.id);
			newButton.set('checked', true);
			this._currentChild = page;
			newButton.focusNode.setAttribute("tabIndex", "0");
			var container = registry.byId(this.containerId);
		},

		onButtonClick: function(/*dijit/_WidgetBase*/ page){
			// summary:
			//		Called whenever one of my child buttons is pressed in an attempt to select a page
			// tags:
			//		private

			var button = this.pane2button(page.id);

			// For TabContainer where the tabs are <span>, need to set focus explicitly when left/right arrow
			focus.focus(button.focusNode);

			if(this._currentChild && this._currentChild.id === page.id){
				//In case the user clicked the checked button, keep it in the checked state because it remains to be the selected stack page.
				button.set('checked', true);
			}
			var container = registry.byId(this.containerId);
			container.selectChild(page);
		},

		onCloseButtonClick: function(/*dijit/_WidgetBase*/ page){
			// summary:
			//		Called whenever one of my child buttons [X] is pressed in an attempt to close a page
			// tags:
			//		private

			var container = registry.byId(this.containerId);
			container.closeChild(page);
			if(this._currentChild){
				var b = this.pane2button(this._currentChild.id);
				if(b){
					focus.focus(b.focusNode || b.domNode);
				}
			}
		},

		// TODO: this is a bit redundant with forward, back api in StackContainer
		adjacent: function(/*Boolean*/ forward){
			// summary:
			//		Helper for onkeydown to find next/previous button
			// tags:
			//		private

			if(!this.isLeftToRight() && (!this.tabPosition || /top|bottom/.test(this.tabPosition))){
				forward = !forward;
			}
			// find currently focused button in children array
			var children = this.getChildren();
			var idx = array.indexOf(children, this.pane2button(this._currentChild.id)),
				current = children[idx];

			// Pick next/previous non-disabled button to focus on.   If we get back to the original button it means
			// that all buttons must be disabled, so return current child to avoid an infinite loop.
			var child;
			do{
				idx = (idx + (forward ? 1 : children.length - 1)) % children.length;
				child = children[idx];
			}while(child.disabled && child != current);

			return child; // dijit/_WidgetBase
		},

		onkeydown: function(/*Event*/ e, /*Boolean?*/ fromContainer){
			// summary:
			//		Handle keystrokes on the page list, for advancing to next/previous button
			//		and closing the current page if the page is closable.
			// tags:
			//		private

			if(this.disabled || e.altKey){
				return;
			}
			var forward = null;
			if(e.ctrlKey || !e._djpage){
				switch(e.keyCode){
					case keys.LEFT_ARROW:
					case keys.UP_ARROW:
						if(!e._djpage){
							forward = false;
						}
						break;
					case keys.PAGE_UP:
						if(e.ctrlKey){
							forward = false;
						}
						break;
					case keys.RIGHT_ARROW:
					case keys.DOWN_ARROW:
						if(!e._djpage){
							forward = true;
						}
						break;
					case keys.PAGE_DOWN:
						if(e.ctrlKey){
							forward = true;
						}
						break;
					case keys.HOME:
						// Navigate to first non-disabled child
						var children = this.getChildren();
						for(var idx = 0; idx < children.length; idx++){
							var child = children[idx];
							if(!child.disabled){
								this.onButtonClick(child.page);
								break;
							}
						}
						e.stopPropagation();
						e.preventDefault();
						break;
					case keys.END:
						// Navigate to last non-disabled child
						var children = this.getChildren();
						for(var idx = children.length - 1; idx >= 0; idx--){
							var child = children[idx];
							if(!child.disabled){
								this.onButtonClick(child.page);
								break;
							}
						}
						e.stopPropagation();
						e.preventDefault();
						break;
					case keys.DELETE:
					case "W".charCodeAt(0):    // ctrl-W
						if(this._currentChild.closable &&
							(e.keyCode == keys.DELETE || e.ctrlKey)){
							this.onCloseButtonClick(this._currentChild);

							// avoid browser tab closing
							e.stopPropagation();
							e.preventDefault();
						}
						break;
					case keys.TAB:
						if(e.ctrlKey){
							this.onButtonClick(this.adjacent(!e.shiftKey).page);
							e.stopPropagation();
							e.preventDefault();
						}
						break;
				}
				// handle next/previous page navigation (left/right arrow, etc.)
				if(forward !== null){
					this.onButtonClick(this.adjacent(forward).page);
					e.stopPropagation();
					e.preventDefault();
				}
			}
		},

		onContainerKeyDown: function(/*Object*/ info){
			// summary:
			//		Called when there was a keydown on the container
			// tags:
			//		private
			info.e._djpage = info.page;
			this.onkeydown(info.e);
		}
	});

	StackController.StackButton = StackButton;	// for monkey patching

	return StackController;
});

},
'dijit/layout/ScrollingTabController':function(){
define([
	"dojo/_base/array", // array.forEach
	"dojo/_base/declare", // declare
	"dojo/dom-class", // domClass.add domClass.contains
	"dojo/dom-geometry", // domGeometry.contentBox
	"dojo/dom-style", // domStyle.style
	"dojo/_base/fx", // Animation
	"dojo/_base/lang", // lang.hitch
	"dojo/on",
	"dojo/query", // query
	"dojo/sniff", // has("ie"), has("webkit"), has("quirks")
	"../registry", // registry.byId()
	"dojo/text!./templates/ScrollingTabController.html",
	"dojo/text!./templates/_ScrollingTabControllerButton.html",
	"./TabController",
	"./utils", // marginBox2contextBox, layoutChildren
	"../_WidgetsInTemplateMixin",
	"../Menu",
	"../MenuItem",
	"../form/Button",
	"../_HasDropDown",
	"dojo/NodeList-dom", // NodeList.style
	"../a11yclick"	// template uses ondijitclick (not for keyboard support, but for responsive touch support)
], function(array, declare, domClass, domGeometry, domStyle, fx, lang, on, query, has,
	registry, tabControllerTemplate, buttonTemplate, TabController, layoutUtils, _WidgetsInTemplateMixin,
	Menu, MenuItem, Button, _HasDropDown){

	// module:
	//		dijit/layout/ScrollingTabController

	var ScrollingTabController = declare("dijit.layout.ScrollingTabController", [TabController, _WidgetsInTemplateMixin], {
		// summary:
		//		Set of tabs with left/right arrow keys and a menu to switch between tabs not
		//		all fitting on a single row.
		//		Works only for horizontal tabs (either above or below the content, not to the left
		//		or right).
		// tags:
		//		private

		baseClass: "dijitTabController dijitScrollingTabController",

		templateString: tabControllerTemplate,

		// useMenu: [const] Boolean
		//		True if a menu should be used to select tabs when they are too
		//		wide to fit the TabContainer, false otherwise.
		useMenu: true,

		// useSlider: [const] Boolean
		//		True if a slider should be used to select tabs when they are too
		//		wide to fit the TabContainer, false otherwise.
		useSlider: true,

		// tabStripClass: [const] String
		//		The css class to apply to the tab strip, if it is visible.
		tabStripClass: "",

		// _minScroll: Number
		//		The distance in pixels from the edge of the tab strip which,
		//		if a scroll animation is less than, forces the scroll to
		//		go all the way to the left/right.
		_minScroll: 5,

		// Override default behavior mapping class to DOMNode
		_setClassAttr: { node: "containerNode", type: "class" },

		buildRendering: function(){
			this.inherited(arguments);
			var n = this.domNode;

			this.scrollNode = this.tablistWrapper;
			this._initButtons();

			if(!this.tabStripClass){
				this.tabStripClass = "dijitTabContainer" +
					this.tabPosition.charAt(0).toUpperCase() +
					this.tabPosition.substr(1).replace(/-.*/, "") +
					"None";
				domClass.add(n, "tabStrip-disabled")
			}

			domClass.add(this.tablistWrapper, this.tabStripClass);
		},

		onStartup: function(){
			this.inherited(arguments);

			// TabController is hidden until it finishes drawing, to give
			// a less visually jumpy instantiation.   When it's finished, set visibility to ""
			// to that the tabs are hidden/shown depending on the container's visibility setting.
			domStyle.set(this.domNode, "visibility", "");
			this._postStartup = true;

			// changes to the tab button label or iconClass will have changed the width of the
			// buttons, so do a resize
			this.own(on(this.containerNode, "attrmodified-label, attrmodified-iconclass", lang.hitch(this, function(evt){
				if(this._dim){
					this.resize(this._dim);
				}
			})));
		},

		onAddChild: function(page, insertIndex){
			this.inherited(arguments);

			// Increment the width of the wrapper when a tab is added
			// This makes sure that the buttons never wrap.
			// The value 200 is chosen as it should be bigger than most
			// Tab button widths.
			domStyle.set(this.containerNode, "width",
				(domStyle.get(this.containerNode, "width") + 200) + "px");
		},

		onRemoveChild: function(page, insertIndex){
			// null out _selectedTab because we are about to delete that dom node
			var button = this.pane2button(page.id);
			if(this._selectedTab === button.domNode){
				this._selectedTab = null;
			}

			this.inherited(arguments);
		},

		_initButtons: function(){
			// summary:
			//		Creates the buttons used to scroll to view tabs that
			//		may not be visible if the TabContainer is too narrow.

			// Make a list of the buttons to display when the tab labels become
			// wider than the TabContainer, and hide the other buttons.
			// Also gets the total width of the displayed buttons.
			this._btnWidth = 0;
			this._buttons = query("> .tabStripButton", this.domNode).filter(function(btn){
				if((this.useMenu && btn == this._menuBtn.domNode) ||
					(this.useSlider && (btn == this._rightBtn.domNode || btn == this._leftBtn.domNode))){
					this._btnWidth += domGeometry.getMarginSize(btn).w;
					return true;
				}else{
					domStyle.set(btn, "display", "none");
					return false;
				}
			}, this);
		},

		_getTabsWidth: function(){
			var children = this.getChildren();
			if(children.length){
				var leftTab = children[this.isLeftToRight() ? 0 : children.length - 1].domNode,
					rightTab = children[this.isLeftToRight() ? children.length - 1 : 0].domNode;
				return rightTab.offsetLeft + rightTab.offsetWidth - leftTab.offsetLeft;
			}else{
				return 0;
			}
		},

		_enableBtn: function(width){
			// summary:
			//		Determines if the tabs are wider than the width of the TabContainer, and
			//		thus that we need to display left/right/menu navigation buttons.
			var tabsWidth = this._getTabsWidth();
			width = width || domStyle.get(this.scrollNode, "width");
			return tabsWidth > 0 && width < tabsWidth;
		},

		resize: function(dim){
			// summary:
			//		Hides or displays the buttons used to scroll the tab list and launch the menu
			//		that selects tabs.

			// Save the dimensions to be used when a child is renamed.
			this._dim = dim;

			// Set my height to be my natural height (tall enough for one row of tab labels),
			// and my content-box width based on margin-box width specified in dim parameter.
			// But first reset scrollNode.height in case it was set by layoutChildren() call
			// in a previous run of this method.
			this.scrollNode.style.height = "auto";
			var cb = this._contentBox = layoutUtils.marginBox2contentBox(this.domNode, {h: 0, w: dim.w});
			cb.h = this.scrollNode.offsetHeight;
			domGeometry.setContentSize(this.domNode, cb);

			// Show/hide the left/right/menu navigation buttons depending on whether or not they
			// are needed.
			var enable = this._enableBtn(this._contentBox.w);
			this._buttons.style("display", enable ? "" : "none");

			// Position and size the navigation buttons and the tablist
			this._leftBtn.region = "left";
			this._rightBtn.region = "right";
			this._menuBtn.region = this.isLeftToRight() ? "right" : "left";
			layoutUtils.layoutChildren(this.domNode, this._contentBox,
				[this._menuBtn, this._leftBtn, this._rightBtn, {domNode: this.scrollNode, region: "center"}]);

			// set proper scroll so that selected tab is visible
			if(this._selectedTab){
				if(this._anim && this._anim.status() == "playing"){
					this._anim.stop();
				}
				this.scrollNode.scrollLeft = this._convertToScrollLeft(this._getScrollForSelectedTab());
			}

			// Enable/disabled left right buttons depending on whether or not user can scroll to left or right
			this._setButtonClass(this._getScroll());

			this._postResize = true;

			// Return my size so layoutChildren() can use it.
			// Also avoids IE9 layout glitch on browser resize when scroll buttons present
			return {h: this._contentBox.h, w: dim.w};
		},

		_getScroll: function(){
			// summary:
			//		Returns the current scroll of the tabs where 0 means
			//		"scrolled all the way to the left" and some positive number, based on #
			//		of pixels of possible scroll (ex: 1000) means "scrolled all the way to the right"
			return (this.isLeftToRight() || has("ie") < 8 || (has("ie") && has("quirks")) || has("webkit")) ? this.scrollNode.scrollLeft :
				domStyle.get(this.containerNode, "width") - domStyle.get(this.scrollNode, "width")
					+ (has("ie") >= 8 ? -1 : 1) * this.scrollNode.scrollLeft;
		},

		_convertToScrollLeft: function(val){
			// summary:
			//		Given a scroll value where 0 means "scrolled all the way to the left"
			//		and some positive number, based on # of pixels of possible scroll (ex: 1000)
			//		means "scrolled all the way to the right", return value to set this.scrollNode.scrollLeft
			//		to achieve that scroll.
			//
			//		This method is to adjust for RTL funniness in various browsers and versions.
			if(this.isLeftToRight() || has("ie") < 8 || (has("ie") && has("quirks")) || has("webkit")){
				return val;
			}else{
				var maxScroll = domStyle.get(this.containerNode, "width") - domStyle.get(this.scrollNode, "width");
				return (has("ie") >= 8 ? -1 : 1) * (val - maxScroll);
			}
		},

		onSelectChild: function(/*dijit/_WidgetBase*/ page){
			// summary:
			//		Smoothly scrolls to a tab when it is selected.

			var tab = this.pane2button(page.id);
			if(!tab){
				return;
			}

			var node = tab.domNode;

			// Save the selection
			if(node != this._selectedTab){
				this._selectedTab = node;

				// Scroll to the selected tab, except on startup, when scrolling is handled in resize()
				if(this._postResize){
					var sl = this._getScroll();

					if(sl > node.offsetLeft ||
						sl + domStyle.get(this.scrollNode, "width") <
							node.offsetLeft + domStyle.get(node, "width")){
						this.createSmoothScroll().play();
					}
				}
			}

			this.inherited(arguments);
		},

		_getScrollBounds: function(){
			// summary:
			//		Returns the minimum and maximum scroll setting to show the leftmost and rightmost
			//		tabs (respectively)
			var children = this.getChildren(),
				scrollNodeWidth = domStyle.get(this.scrollNode, "width"), // about 500px
				containerWidth = domStyle.get(this.containerNode, "width"), // 50,000px
				maxPossibleScroll = containerWidth - scrollNodeWidth, // scrolling until right edge of containerNode visible
				tabsWidth = this._getTabsWidth();

			if(children.length && tabsWidth > scrollNodeWidth){
				// Scrolling should happen
				return {
					min: this.isLeftToRight() ? 0 : children[children.length - 1].domNode.offsetLeft,
					max: this.isLeftToRight() ?
						(children[children.length - 1].domNode.offsetLeft + children[children.length - 1].domNode.offsetWidth) - scrollNodeWidth :
						maxPossibleScroll
				};
			}else{
				// No scrolling needed, all tabs visible, we stay either scrolled to far left or far right (depending on dir)
				var onlyScrollPosition = this.isLeftToRight() ? 0 : maxPossibleScroll;
				return {
					min: onlyScrollPosition,
					max: onlyScrollPosition
				};
			}
		},

		_getScrollForSelectedTab: function(){
			// summary:
			//		Returns the scroll value setting so that the selected tab
			//		will appear in the center
			var w = this.scrollNode,
				n = this._selectedTab,
				scrollNodeWidth = domStyle.get(this.scrollNode, "width"),
				scrollBounds = this._getScrollBounds();

			// TODO: scroll minimal amount (to either right or left) so that
			// selected tab is fully visible, and just return if it's already visible?
			var pos = (n.offsetLeft + domStyle.get(n, "width") / 2) - scrollNodeWidth / 2;
			pos = Math.min(Math.max(pos, scrollBounds.min), scrollBounds.max);

			// TODO:
			// If scrolling close to the left side or right side, scroll
			// all the way to the left or right.  See this._minScroll.
			// (But need to make sure that doesn't scroll the tab out of view...)
			return pos;
		},

		createSmoothScroll: function(x){
			// summary:
			//		Creates a dojo._Animation object that smoothly scrolls the tab list
			//		either to a fixed horizontal pixel value, or to the selected tab.
			// description:
			//		If an number argument is passed to the function, that horizontal
			//		pixel position is scrolled to.  Otherwise the currently selected
			//		tab is scrolled to.
			// x: Integer?
			//		An optional pixel value to scroll to, indicating distance from left.

			// Calculate position to scroll to
			if(arguments.length > 0){
				// position specified by caller, just make sure it's within bounds
				var scrollBounds = this._getScrollBounds();
				x = Math.min(Math.max(x, scrollBounds.min), scrollBounds.max);
			}else{
				// scroll to center the current tab
				x = this._getScrollForSelectedTab();
			}

			if(this._anim && this._anim.status() == "playing"){
				this._anim.stop();
			}

			var self = this,
				w = this.scrollNode,
				anim = new fx.Animation({
					beforeBegin: function(){
						if(this.curve){
							delete this.curve;
						}
						var oldS = w.scrollLeft,
							newS = self._convertToScrollLeft(x);
						anim.curve = new fx._Line(oldS, newS);
					},
					onAnimate: function(val){
						w.scrollLeft = val;
					}
				});
			this._anim = anim;

			// Disable/enable left/right buttons according to new scroll position
			this._setButtonClass(x);

			return anim; // dojo/_base/fx/Animation
		},

		_getBtnNode: function(/*Event*/ e){
			// summary:
			//		Gets a button DOM node from a mouse click event.
			// e:
			//		The mouse click event.
			var n = e.target;
			while(n && !domClass.contains(n, "tabStripButton")){
				n = n.parentNode;
			}
			return n;
		},

		doSlideRight: function(/*Event*/ e){
			// summary:
			//		Scrolls the menu to the right.
			// e:
			//		The mouse click event.
			this.doSlide(1, this._getBtnNode(e));
		},

		doSlideLeft: function(/*Event*/ e){
			// summary:
			//		Scrolls the menu to the left.
			// e:
			//		The mouse click event.
			this.doSlide(-1, this._getBtnNode(e));
		},

		doSlide: function(/*Number*/ direction, /*DomNode*/ node){
			// summary:
			//		Scrolls the tab list to the left or right by 75% of the widget width.
			// direction:
			//		If the direction is 1, the widget scrolls to the right, if it is -1,
			//		it scrolls to the left.

			if(node && domClass.contains(node, "dijitTabDisabled")){
				return;
			}

			var sWidth = domStyle.get(this.scrollNode, "width");
			var d = (sWidth * 0.75) * direction;

			var to = this._getScroll() + d;

			this._setButtonClass(to);

			this.createSmoothScroll(to).play();
		},

		_setButtonClass: function(/*Number*/ scroll){
			// summary:
			//		Disables the left scroll button if the tabs are scrolled all the way to the left,
			//		or the right scroll button in the opposite case.
			// scroll: Integer
			//		amount of horizontal scroll

			var scrollBounds = this._getScrollBounds();
			this._leftBtn.set("disabled", scroll <= scrollBounds.min);
			this._rightBtn.set("disabled", scroll >= scrollBounds.max);
		}
	});


	var ScrollingTabControllerButtonMixin = declare("dijit.layout._ScrollingTabControllerButtonMixin", null, {
		baseClass: "dijitTab tabStripButton",

		templateString: buttonTemplate,

		// Override inherited tabIndex: 0 from dijit/form/Button, because user shouldn't be
		// able to tab to the left/right/menu buttons
		tabIndex: "",

		// Similarly, override FormWidget.isFocusable() because clicking a button shouldn't focus it
		// either (this override avoids focus() call in FormWidget.js)
		isFocusable: function(){
			return false;
		}
	});

	// Class used in template
	declare("dijit.layout._ScrollingTabControllerButton", [Button, ScrollingTabControllerButtonMixin]);

	// Class used in template
	declare("dijit.layout._ScrollingTabControllerMenuButton", [Button, _HasDropDown, ScrollingTabControllerButtonMixin], {
		// id of the TabContainer itself
		containerId: "",

		// -1 so user can't tab into the button, but so that button can still be focused programatically.
		// Because need to move focus to the button (or somewhere) before the menu is hidden or IE6 will crash.
		tabIndex: "-1",

		isLoaded: function(){
			// recreate menu every time, in case the TabContainer's list of children (or their icons/labels) have changed
			return false;
		},

		loadDropDown: function(callback){
			this.dropDown = new Menu({
				id: this.containerId + "_menu",
				ownerDocument: this.ownerDocument,
				dir: this.dir,
				lang: this.lang,
				textDir: this.textDir
			});
			var container = registry.byId(this.containerId);
			array.forEach(container.getChildren(), function(page){
				var menuItem = new MenuItem({
					id: page.id + "_stcMi",
					label: page.title,
					iconClass: page.iconClass,
					disabled: page.disabled,
					ownerDocument: this.ownerDocument,
					dir: page.dir,
					lang: page.lang,
					textDir: page.textDir || container.textDir,
					onClick: function(){
						container.selectChild(page);
					}
				});
				this.dropDown.addChild(menuItem);
			}, this);
			callback();
		},

		closeDropDown: function(/*Boolean*/ focus){
			this.inherited(arguments);
			if(this.dropDown){
				this._popupStateNode.removeAttribute("aria-owns");	// remove ref to node that we are about to delete
				this.dropDown.destroyRecursive();
				delete this.dropDown;
			}
		}
	});

	return ScrollingTabController;
});

},
'rdforms/formulator/ItemEditor':function(){
/*global define*/
define([
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
},
'dijit/form/ComboBox':function(){
define([
	"dojo/_base/declare", // declare
	"./ValidationTextBox",
	"./ComboBoxMixin"
], function(declare, ValidationTextBox, ComboBoxMixin){

	// module:
	//		dijit/form/ComboBox

	return declare("dijit.form.ComboBox", [ValidationTextBox, ComboBoxMixin], {
		// summary:
		//		Auto-completing text box
		//
		// description:
		//		The drop down box's values are populated from an class called
		//		a data provider, which returns a list of values based on the characters
		//		that the user has typed into the input box.
		//		If OPTION tags are used as the data provider via markup,
		//		then the OPTION tag's child text node is used as the widget value
		//		when selected.  The OPTION tag's value attribute is ignored.
		//		To set the default value when using OPTION tags, specify the selected
		//		attribute on 1 of the child OPTION tags.
		//
		//		Some of the options to the ComboBox are actually arguments to the data
		//		provider.
	});
});

},
'rdforms/formulator/LangString':function(){
/*global define*/
define(["dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/dom-class",
    "dojo/dom-construct",
    "dojo/dom-attr",
    "dijit/_Widget",
    "dijit/form/TextBox",
    "dijit/form/Textarea",
    "dijit/form/ComboBox",
    "dojo/store/Memory"
], function(declare, lang, domClass, construct, attr, Widget, TextBox, Textarea, ComboBox, Memory) {
    return declare(Widget, {
        buildRendering: function() {
            this.domNode = this.srcNodeRef || construct.create("div");
            domClass.add(this.domNode, "langStringArr");
            var timer;
            this._onChange = lang.hitch(this, function() {
                    if (timer) {
                        clearTimeout(timer);
                    }
                    timer = setTimeout(lang.hitch(this, function() {
                        timer = null;
                        this.onChange(this.getMap());
                    }), 200);
            });
            this._comboChoiceStore = new Memory({
                data: [
                    {id:"en"},
                    {id:"sv"},
                    {id:"de"},
                    {id:"es"},
                    {id:"fr"},
                    {id:"it"}
                ]
            });
        },
        onChange: function(map) {
        },
        setMap: function(map) {
            map = map || {};
            if (this._rows) {
                for (var i=0;i<this._rows.length;i++) {
                    this._rows[i].lang.destroy();
                    this._rows[i].text.destroy();
                }
                this._rows = [];
                attr.set(this.domNode, "innerHTML", "");
            }
            for (var key in map) {
                if (map.hasOwnProperty(key)) {
                    this._add(map[key], key);
                }
            }
            if (this._rows == null || this._rows.length == 0) {
                this._add("", "");
            }
        },
        getMap: function() {
            var map = {};
            for(var i=0;i<this._rows.length;i++) {
                var row = this._rows[i];
                var l = row.lang.get("value") || "";
                var t = row.text.get("value");
                if (t != null && t !== "") {
                    map[l] = t;
                }
            }
            return map;
        },
        add: function() {
            this._add("", "");
        },
        _add: function(s, l) {
            var row = construct.create("div", {"class": "langString"}, this.domNode);
            var textNode = construct.create("div", {"class": "langStringString"}, row);
            var langNode = construct.create("div", {"class": "langStringLang"}, row);
            var text;
            if (this.multiline) {
                text = Textarea({value: s, disabled: this.get("disabled"), onChange: this._onChange, intermediateChanges: true}, construct.create("div", null, textNode));
                text.resize();
            } else {
                text = TextBox({value: s, disabled: this.get("disabled"), onChange: this._onChange, intermediateChanges: true}, construct.create("div", null, textNode));
            }
            var lang = ComboBox({value: l, disabled: this.get("disabled"), onChange: this._onChange, store: this._comboChoiceStore, searchAttr: "id"}, construct.create("div", null, langNode));
            if (this._rows == null) {
                this._rows = [];
            }
            this._rows.push({row: row, text: text, lang: lang});
        }
    });
});
},
'dojo/dnd/Target':function(){
define([ "../_base/declare", "../dom-class", "./Source" ], function(declare, domClass, Source){
	return declare("dojo.dnd.Target", Source, {
		// summary:
		//		a Target object, which can be used as a DnD target

		constructor: function(/*===== node, params =====*/){
			// summary:
			//		a constructor of the Target --- see the `dojo/dnd/Source` constructor for details
			this.isSource = false;
			domClass.remove(this.node, "dojoDndSource");
		}
	});
});

},
'rdforms/formulator/ItemTreeModel':function(){
/*global define*/
define(["dojo/_base/declare", "../template/Group", "../template/Bundle", "../template/Item"], function(declare, Group, Bundle, Item) {

    var sortItemsWithId = function (i1, i2) {
        var lab1 = i1.getId() || i1.getProperty();
        var lab2 = i2.getId() || i2.getProperty();
        if (lab1 > lab2) {
            return 1;
        } else if (lab1 < lab2) {
            return -1;
        } else {
            return 0;
        }
    };

    var sortBundles = function(b1, b2) {
        if (b1.isReadOnly() && !b2.isReadOnly()) {
            return 1;
        }
        if (b2.isReadOnly() && !b1.isReadOnly()) {
            return -1;
        }

        var lab1 = b1.getPath() || b1.getInternalId();
        var lab2 = b2.getPath() || b2.getInternalId();
        if (lab1 > lab2) {
            return 1;
        } else if (lab1 < lab2) {
            return -1;
        } else {
            return 0;
        }
    };

    return declare(null, {
        constructor: function(itemStore) {
            this.itemStore = itemStore;
        },
        getRoot: function(onItem){
            onItem(this.itemStore);
        },
        mayHaveChildren: function(/*dojo.data.Item*/ item){
            return item instanceof Group || item instanceof Bundle || item === this.itemStore;
        },
        getChildren: function(/*dojo.data.Item*/ parentItem, /*function(items)*/ onComplete, onError){
            if (parentItem instanceof Group) {
                onComplete(parentItem.getChildren(true));
            } else if (parentItem instanceof Bundle) {
                onComplete(parentItem.getItems().sort(sortItemsWithId));
            } else if (parentItem === this.itemStore) {
                onComplete(parentItem.getBundles().sort(sortBundles));
            } else {
                onComplete([]);
            }
        },
        showError: function(entry, message) {
        },
        getIdentity: function(/* item */ item){
            if (item instanceof Bundle) {
                return item.getInternalId();
            } else if (item === this.itemStore) {
                return "___root";
            } else {
                return item._internalId;
            }
        },
        getLabel: function(/*dojo.data.Item*/ item){
            if (item instanceof Bundle) {
                return item.getPath() || item.getInternalId();
            } else if (item === this.itemStore) {
                return "Root node";
            } else {
                return item.getId(true) || item.getLabel(false, true) || item.getId() || item.getLabel() || item.getProperty(true) || item.getProperty() || "??? (missing label and/or property).";
            }
        },


        // =======================================================================
        // Write interface

        // summary
        // Creates a new item.   See dojo.data.api.Write for details on args.
        newItem: function(/* Object? */ args, /*Item?*/ parent, insertIndex){
            var source, children;
            if (args.id) {
                //Do a reference
                source = {id: args.id};
            } else {
                //Insert inline
                source = args.getSource(true);
            }
            var bundle;
            if (parent instanceof Bundle) {
                //If parent is a bundle the item is already registered and added to the bundles list of children.
                children = parent.getItems();
                var templates = parent.getSource().templates || parent.getSource().auxilliary;
                templates.push(source);
            } else if (parent === this.itemStore) {
                //Should never happen
                throw "Solve in calling method instead.";
                /*var bundle = this.itemStore().getBundles()[0];
            var src = bundle.getSource();
            var templates = src.templates || src.auxilliary;
            templates.push(source);
            bundle.addItem(args);
            children = bundle.getItems();*/
            } else {
                children = parent.getChildren(true);
                var psource = parent.getSource(true);
                psource.items = psource.items || [];
                if (isNaN(insertIndex)) {
                    psource.items.push(source);
                    children.push(args);
                } else {
                    psource.items.splice(insertIndex, 0, source);
                    children.splice(insertIndex, 0, args);
                }
            }
            this.onChildrenChange(parent, children);
        },
        removeItem: function(item, parent) {
            if (parent === this.itemStore) {
                return;
            }
            var oldItems;
            var oldSource;

            if (parent instanceof Bundle) {
                var oldItems = parent.getItems();
                var oldSource = parent.getSource().templates || parent.getSource().auxilliary;
                var itemIndex = oldItems.indexOf(item);
                oldItems.splice(itemIndex, 1);
                var srcIndex = oldSource.indexOf(item.getSource(true)); //Bundle is reordered, find source-index.
                oldSource.splice(srcIndex, 1);
            } else {
                var oldItems = parent.getChildren(true);
                var oldSource = parent.getSource(true).items;
                var itemIndex = oldItems.indexOf(item);
                oldItems.splice(itemIndex, 1);
                oldSource.splice(itemIndex, 1); //No reordering is Groups
            }
            this.onChildrenChange(parent, oldItems);
        },
        isItem: function(item) {
            return item === this.itemStore || item instanceof Bundle || item instanceof Item;
//        var children = this.item.getChildren(true);
//        return children.indexOf(item) != -1;
        },

        getPasteAction: function(item, oldParentItem, newParentItem) {
            if (oldParentItem === this.itemStore || newParentItem === this.itemStore) {
                return "NA_paste_item_in_or_from_itemStore";
            }
            if (oldParentItem instanceof Bundle) {
                //Reorder items in a bundle not allowed.
                if (oldParentItem === newParentItem) {
                    return "NA_bundle_reorder";
                }
                if (newParentItem instanceof Bundle) { //Move between bundles
                    return "NA_move_between_bundles";
                } else { //Create reference in a Group somewhere.
                    if (newParentItem.getChildren().indexOf(item) === -1) {
                        if (newParentItem.getBundle().isReadOnly()) {
                            return "NA_readOnly_destination";
                        } else {
                            return "reference_item_in_group";
                        }
                    } else {
                        return "NA_item_already_referenced_in_group";
                    }
                }
            } else {
                if (newParentItem instanceof Bundle) {
                    if (item.getBundle() === newParentItem) {
                        return "NA_un_inline";
                    } else {
                        return "NA_cross_bundle_un_inline";
                    }
                } else {
                    if (newParentItem.getBundle().isReadOnly()) {
                        return "NA_readOnly_destination";
                    } else if (oldParentItem === newParentItem) {
                        return "reorder_in_group";
                    } else if (oldParentItem.getBundle() === newParentItem.getBundle()) {
                        return "move_between_groups_in_same_bundle";
                    } else if (oldParentItem.getBundle().isReadOnly()) {
                        return "NA_move_from_readOnly_source";
                    } else {
                        return "move_between_groups_in_different_bundles";
                    }
                }
            }
        },


        // summary
        //      Move or copy an item from one parent item to another.
        //      Used in drag & drop.
        //      If oldParentItem is specified and bCopy is false, childItem is removed from oldParentItem.
        //      If newParentItem is specified, childItem is attached to newParentItem.
        pasteItem: function(/*Item*/ childItem, /*Item*/ oldParentItem, /*Item*/ newParentItem, /*Boolean*/ bCopy, insertIndex) {
            var action = this.getPasteAction(childItem, oldParentItem, newParentItem);
            if (action[0] === "N") {
                return;
            }
            var oldItems, oldSource;
            //newParentItem is a group, since it is not allowed to be the ItemStore or a Bundle
            var newItems = newParentItem.getChildren(true);
            var newSource = newParentItem.getSource(true);
            newSource.items = newSource.items || [];
            newSource = newSource.items;

            switch(action) {
                case "reference_item_in_group":
                    insertIndex = isNaN(insertIndex) ? newItems.length : insertIndex;
                    newItems.splice(insertIndex, 0, childItem);
                    newSource.splice(insertIndex, 0, {id: childItem.getId()});
                    this.onChildrenChange(newParentItem, newItems);
                    break;
                case "reorder_in_group":
                case "move_between_groups_in_same_bundle":
                case "move_between_groups_in_different_bundles":
                    oldItems = oldParentItem.getChildren(true);
                    oldSource = oldParentItem.getSource(true).items;
                    var oldIndex = oldItems.indexOf(childItem);
                    var childItemSource = oldSource[oldIndex];
                    oldItems.splice(oldIndex, 1);
                    oldSource.splice(oldIndex, 1);
                    insertIndex = isNaN(insertIndex) ? newItems.length : insertIndex;
                    newItems.splice(insertIndex, 0, childItem);
                    newSource.splice(insertIndex, 0, childItemSource);
                    this.onChildrenChange(newParentItem, newItems);
                    if (oldParentItem !== newParentItem) {
                        this.onChildrenChange(oldParentItem, oldItems);
                    }
                    break;
            }
        },
        // summary
        //      Move or copy an item from one parent item to another.
        //      Used in drag & drop.
        //      If oldParentItem is specified and bCopy is false, childItem is removed from oldParentItem.
        //      If newParentItem is specified, childItem is attached to newParentItem.
        old_pasteItem: function(/*Item*/ childItem, /*Item*/ oldParentItem, /*Item*/ newParentItem, /*Boolean*/ bCopy, insertIndex) {
            if (oldParentItem === this.itemStore || newParentItem === this.itemStore) {
                return;
            }
            var ref;
            var oldItems, oldSource;
            if (oldParentItem instanceof Bundle) {
                oldItems = oldParentItem.getItems();
                oldSource = oldParentItem.getSource();
                oldSource = oldSource.templates || oldSource.auxilliary;
            } else {
                oldItems = oldParentItem.getChildren(true);
                oldSource = oldParentItem.getSource(true).items;
            }
            if (oldSource) {  //If oldsource exists, then we are not in fake root.
                var oldIndex = oldItems.indexOf(childItem);
                if (childItem.getId() == null) {
                    ref = oldSource[oldIndex];
                } else {
                    ref = {id: childItem.getId()};
                }
                oldItems.splice(oldIndex, 1);
                oldSource.splice(oldIndex, 1);
            } else {
                ref = {id: childItem.getId()};
            }

            if (oldParentItem === newParentItem) {
                if (isNaN(insertIndex)) {
                    oldItems.push(childItem);
                    oldSource.push(ref);
                } else {
                    oldItems.splice(insertIndex, 0, childItem);
                    oldSource.splice(insertIndex, 0, ref);
                }
                this.onChildrenChange(oldParentItem, oldItems);
            } else {
                var newSource, newItems;
                if (newParentItem instanceof Bundle) {
                    newSource = newParentItem.getSource();
                    if (newSource.templates == null && newSource.auxilliary == null) {
                        newSource.templates = [];
                    }
                    newSource = newSource.templates || newSource.auxilliary;
                    newItems = newParentItem.getItems();
                } else {
                    newSource = newParentItem.getSource(true);
                    newSource.items = newSource.items || [];
                    newSource = newSource.items;
                    newItems = newParentItem.getChildren(true);
                }


                if (isNaN(insertIndex)) {
                    newItems.push(childItem);
                    newSource.push(ref);
                } else {
                    newItems.splice(insertIndex, 0, childItem);
                    newSource.splice(insertIndex, 0, ref);
                }
                if (oldSource) {
                    this.onChildrenChange(oldParentItem, oldItems);
                }
                this.onChildrenChange(newParentItem, newItems);
            }
        },

	// =======================================================================

        // Callbacks
        // summary
        //            Callback whenever an item has changed, so that Tree
        //            can update the label, icon, etc.   Note that changes
        //            to an item's children or parent(s) will trigger an
        //            onChildrenChange() so you can ignore those changes here.
	onChange: function(/*dojo.data.Item*/ item){
	},
        // summary
        //            Callback to do notifications about new, updated, or deleted items.
	onChildrenChange: function(/*dojo.data.Item*/ parent, /*dojo.data.Item[]*/ newChildrenList){
        if (parent.originalChildrenChanged) {
            parent.originalChildrenChanged();
        }
    }
    });
});
},
'rdforms/template/Bundle':function(){
/*global define*/
define(["dojo/_base/declare"], function(declare) {

    var counter = 0;
    /**
     * A Bundle corresponds to a set of items typically managed in a single file.
     */
    return declare(null, {
        //===================================================
        // Private attributes
        //===================================================
        _itemStore: null,
        _source: null,
        _path: null,
        _items: null,
        _root: null,
        _id: null,
        _modified: false,
        _readOnly: false,

        //===================================================
        // Public API
        //===================================================
        getInternalId: function() {
            return this._id;
        },

        getSource: function() {
            return this._source;
        },
        setRoot: function(itemId) {
            return this._source.root = itemId;
        },
        getRoot: function() {
            if (this._source.root) {
                return this._itemStore.getItem(this._source.root);
            }
        },
        getItemStore: function() {
            return this._itemStore;
        },
        getPath: function() {
            return this._path;
        },

        getItems: function() {
            return this._items;
        },

        addItem: function(item) {
            this._items.push(item);
        },

        removeItem: function(item) {
            this._items.splice(this._items.indexOf(item), 1);
        },

        isModified: function() {
           return this._modified;
        },

        setModified: function(modified) {
            this._modified = modified;
        },

        isReadOnly: function() {
            return this._readOnly || this._path == null;
        },

        //===================================================
        // Inherited methods
        //===================================================
        constructor: function(params) {
            this._itemStore = params.itemStore;
            this._source = params.source;
            this._path = params.path;
            this._readOnly = params.readOnly;
            this._items = [];
            counter++;
            this._id = "_bundle_"+counter;
        }
    });
});
},
'rdforms/formulator/ChoicesEditor':function(){
/*global define*/
define(["dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/_base/array",
    "dojo/aspect",
    "dojo/on",
    "dojo/dom-class",
    "dojo/dom-construct",
    "dojo/dom-style",
    "dijit/registry",
    "dijit/layout/_LayoutWidget",
    "dijit/_TemplatedMixin",
    "dijit/_WidgetsInTemplateMixin",
    "dijit/Tree",
    "dijit/Menu",
    "dijit/MenuItem",
    //For template
    //For template
    //For template
    //For template
    //For template
    "dijit/tree/dndSource",
    "./ChoicesTreeModel",
    "dojo/text!./ChoicesEditorTemplate.html"
], function(declare, lang, array, aspect, on, domClass, construct, style, registry, _LayoutWidget, _TemplatedMixin, _WidgetsInTemplateMixin, Tree,
            Menu, MenuItem, TreeDndSource, ChoicesTreeModel, template) {

    return declare([_LayoutWidget, _TemplatedMixin, _WidgetsInTemplateMixin], {
        choices: [],
        templateString: template,
        postCreate: function() {
            this.choices = this.item.getStaticChoices() || [];
            this.inherited("postCreate", arguments);
            var readOnly = this.item.getBundle().isReadOnly();


            this.tree = new Tree({
                showRoot: true,
                model: new ChoicesTreeModel(this.choices),
                disabled: readOnly,
                dndController: TreeDndSource,
                checkItemAcceptance: function(node,source,position) {
                    return !readOnly && position === "over";
                },
                betweenThreshold: 5,
                onClick: lang.hitch(this, this._editChoice)
            }, construct.create("div", null, this._treeNode));
            this.tree.startup();

            if (readOnly) {
                array.forEach(["_valueDijit", "_labelLangString", "_descLangString", "_valueDijit", "_selectable",
                    "_inlineDijit", "_ontologyDijit", "_ppDijit", "_ppinvDijit", "_hpDijit", "_hpinvDijit"], function(wid) {
                    this[wid].set("disabled", "true");
                }, this);
            } else {
                this._valueDijit.validator = lang.hitch(this, function(value, constraints){
                    var model = this.tree.get("model");
                    if (this._choice == null || this._choice.value === value) {
                        return true;
                    }
                    return model.isNameFree(value);
                });
                aspect.before(this._labelLangString, "onChange", lang.hitch(this, "_setLabelMap"));
                on(this._addLabel, "click", lang.hitch(this._labelLangString, this._labelLangString.add));
                aspect.before(this._descLangString, "onChange", lang.hitch(this, "_setDescriptionMap"));
                on(this._addDesc, "click", lang.hitch(this._descLangString, this._descLangString.add));
                var self = this;
                this.menu = new Menu({
                    targetNodeIds: [this.tree.id],
                    selector: ".dijitTreeNode"
                });
                this.menu.addChild(new MenuItem({
                    label: "New Choice",
                    iconClass: "dijitIconFile",
                    onClick: function() {
                        var tn = registry.byNode(this.getParent().currentTarget);
                        var treeModel = self.tree.get("model");
                        var newChoice = {value: ""+(new Date()).getTime()};
                        treeModel.newItem(newChoice, tn.item);
                        var newtn = self.tree.getNodesByItem(newChoice)[0];
                        tn.expand();
                        self.tree.focusNode(newtn);
                        self.tree.set("selectedItem", newChoice);
                        self._editChoice(newChoice);
                    }
                }));
                this.menu.addChild(new MenuItem({
                    label: "Remove choice",
                    iconClass: "dijitEditorIcon dijitEditorIconDelete",
                    onClick: function() {
                        var tn = registry.byNode(this.getParent().currentTarget);
                        var treeModel = self.tree.get("model");
                        treeModel.removeItem(tn.item, tn.getParent().item);
                        self._choicesChanged();
                    }
                }));

                this.menu.startup();
            }

            this._inlineDijit.set("checked", this.item.getStaticChoices() != null);
            this._ontologyDijit.set("value", this.item.getOntologyUrl() || "");
            this._ppDijit.set("value", this.item.getParentProperty() || "");
            this._ppinvDijit.set("checked", this.item.isParentPropertyInverted() || false);
            this._hpDijit.set("value", this.item.getHierarchyProperty() || "");
            this._hpinvDijit.set("checked", this.item.isHierarchyPropertyInverted() || false);
        },
        resize: function () {
            this.inherited("resize", arguments);
            if (this._bcDijit) {
                this._bcDijit.resize();
            }
        },
        _choicesChanged: function() {
            this.tree.get("model").onChange(this._choice);
            this.onChange();
        },
        onChange: function() {
        },
        _editChoice: function(choice) {
            var model = this.tree.get("model");
            if (choice === model.root) {
                return;
            }
            this._choice = choice;
            this._valueDijit.set("value", choice.value);
            this._labelLangString.setMap(choice.label);
            this._descLangString.setMap(choice.description);
            this._selectable.set("checked", choice.selectable !== false);
        },
        _changeInline: function() {
            if (this._inlineDijit.get("checked")) {
                this.item.setStaticChoices(this.choices);
                style.set(this.tree.domNode, "display", "");
                style.set(this._controlDijit.domNode, "height", "25px");
                domClass.add(this._controlDijit.domNode, "inlineState");
                this._bcDijit.resize();
            } else {
                this.item.setStaticChoices();
                style.set(this.tree.domNode, "display", "none");
                style.set(this._controlDijit.domNode, "height", "45%");
                domClass.remove(this._controlDijit.domNode, "inlineState");
                this._bcDijit.resize();
            }
        },
        _changeOntologyUrl: function() {
            this.item.setOntologyUrl(this._ontologyDijit.get("value"));
        },
        _changePProperty: function() {
            this.item.setParentProperty(this._ppDijit.get("value"));
        },
        _changePPI: function() {
            this.item.setParentPropertyInverted(this._ppinvDijit.get("checked"));
        },
        _changeHProperty: function() {
            this.item.setHierarchyProperty(this._hpDijit.get("value"));
        },
        _changeHPI: function() {
            this.item.setHierarchyPropertyInverted(this._hpinvDijit.get("checked"));
        },
        _changeSelectable: function() {
            if (this._selectable.get("checked") === false) {
                this._choice.selectable = false;
            } else {
                delete this._choice.selectable;
            }
            this._choicesChanged();
        },
        _setLabelMap: function(map) {
            this._choice.label = map;
            this._choicesChanged();
        },
        _setDescriptionMap: function(map) {
            this._choice.description = map;
            this._choicesChanged();
        },
        _changeValue: function() {
            if (this._valueTimer) {
                clearTimeout(this._valueTimer);
            }
            this._valueTimer = setTimeout(lang.hitch(this, function() {
                delete this._valueTimer;
                if (this._destroyed) {
                    return;
                }
                var val = this._valueDijit.get("value");
                if (val != null) {
                    var model = this.tree.get("model");
                    model.renameItem(this._choice, val);
                }
                this._choicesChanged();
            }), 200);
        }
   });
});
},
'rdforms/formulator/ChoicesTreeModel':function(){
/*global define*/
define([
    "dojo/_base/lang",
    "dojo/_base/declare",
    "dojo/_base/array",
    "../view/ChoicesTreeModel"
], function (lang, declare, array, ChoicesTreeModel) {

    return declare(ChoicesTreeModel, {
        postscript: function () {
            this._detectTops();
        },
        _detectTops: function () {
            array.forEach(this.choices, function(child) {
                delete child.top;
            })
            var rootChildren = this._getChildren(this.root);
            if (rootChildren.length < this.choices.length) {
                array.forEach(rootChildren, function(child) {
                    child.top = true;
                });
            }
        },
        getIdentity: function (/* item */ item) {
            if (item === this.root) {
                return this.root.value;
            }
            var obj = this.choiceIdx[item.value];
            if (obj) {
                return this.choiceIdx[item.value].id;
            } else {
                return (this._temporaryIdx || {})[item.value];
            }
        },

        // =======================================================================
        // Write interface
        // summary
        // Creates a new item.   See dojo.data.api.Write for details on args.
        newItem: function (/* Object? */ args, /*Item?*/ parent, insertIndex) {
            this.choices.push(args);
            this.choiceIdx[args.value] = {choice: args, id: this._newId()};
            if (parent !== this.root) {
                this.choiceIdx[args.value].parent = parent;
                parent.children = parent.children || [];
                parent.children.push({_reference: args.value});
            }
            this._detectTops();
            this.onChildrenChange(parent, this._getChildren(parent));
        },
        isNameFree: function (name) {
            return this.choiceIdx[name] == null;
        },
        renameItem: function (item, to) {
            var from = item.value;
            if (from === to || this.choiceIdx[to]) {
                return false;
            }
            var obj = this.choiceIdx[from];
            delete this.choiceIdx[from];
            this.choiceIdx[to] = obj;
            item.value = to;
            array.forEach(this.choices, function (choice) {
                if (choice.children) {
                    array.forEach(choice.children, function (child) {
                        if (child._reference === from) {
                            child._reference = to;
                        }
                    });
                }
            });
            this.onChange(item);
        },

        removeItem: function (item, parent) {
            this._removeItem(item, parent);
            this._detectTops();
            this.onChildrenChange(parent, this._getChildren(parent));
            //Temporary index to allow tree to find the right ids and remove the subtree.
            setTimeout(lang.hitch(this, function() {
                delete this._temporaryIdx;
            },100));
        },
        _removeItem: function (item, parent) {
            var oldIndex = this.choices.indexOf(item);
            this.choices.splice(oldIndex, 1);
            this._temporaryIdx = this._temporaryIdx || [];
            this._temporaryIdx[item.value] = this.choiceIdx[item.value].id;
            delete this.choiceIdx[item.value];
            parent.children = array.filter(parent.children, function (child) {
                return child._reference !== item.value;
            });
            if (parent.children.length === 0) {
                delete parent.children;
            }
            if (item.children) {
                array.forEach(item.children, function(child) {
                    this._removeItem(this.choiceIdx[child._reference].choice, item);
                }, this);
            }
        },
        isItem: function (item) {
            return this.choices.indexOf(item) != -1;
        },
        pasteItem: function (/*Item*/ childItem, /*Item*/ oldParentItem, /*Item*/ newParentItem, /*Boolean*/ bCopy, insertIndex) {
            if (oldParentItem === newParentItem) {
                return;
            }
            //Remove from old parent.
            if (oldParentItem !== this.root) {
                oldParentItem.children = array.filter(oldParentItem.children, function (child) {
                    return child._reference !== childItem.value;
                });
                if (oldParentItem.children.length === 0) {
                    delete oldParentItem.children;
                }
            }
            //Add to new parent
            if (newParentItem !== this.root) {
                newParentItem.children = newParentItem.children || [];
                newParentItem.children.push({_reference: childItem.value});
                this.choiceIdx[childItem.value].parent = newParentItem;
            } else {
                delete this.choiceIdx[childItem.value].parent;
            }
            this._detectTops();
            this.onChildrenChange(oldParentItem, this._getChildren(oldParentItem));
            this.onChildrenChange(newParentItem, this._getChildren(newParentItem));
        },
        // =======================================================================

        // Callbacks
        // summary
        //            Callback whenever an item has changed, so that Tree
        //            can update the label, icon, etc.   Note that changes
        //            to an item's children or parent(s) will trigger an
        //            onChildrenChange() so you can ignore those changes here.
        onChange: function (/*dojo.data.Item*/ item) {
        },
        // summary
        //            Callback to do notifications about new, updated, or deleted items.
        onChildrenChange: function (/*dojo.data.Item*/ parent, /*dojo.data.Item[]*/ newChildrenList) {
        }
    });
});
},
'rdforms/apps/Experiment':function(){
/*global define*/
define(["dojo/_base/declare", 
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
},
'rdfjson/Graph':function(){
/*global define*/
define([
    "./formats/rdfjson/util",
    "./Statement",
    "./namespaces"
], function (util, Statement, namespaces) {

    /**
     * @param {Array} arr
     * @returns {*}
     * @private
     */
    var zeroOrOne = function (arr) {
        if (arr.length === 0) {
            return arr;
        } else {
            return [arr[0]];
        }
    };

    /**
     * @param {rdfjson.Graph} graph
     * @param {rdfjson.Statement[]} statements an array
     * @param {Boolean=} perSubject if true means that all consecutive calls will be focused on all the subjects
     * of the specified statments, otherwise the resource objects of the statements will be the focus. Assumed to be false unless explicitly set to true.
     *
     * @returns {{object: Function, objects: Function, constr: Function, each: Function, nodes: Function, values: Function, firstValue: Function}}
     * @private
     */
    var perStatement = function (graph, statements, perSubject) {
        return {
            object: function (predicate) {
                for (var i = 0; i < statements.length; i++) {
                    var subj;
                    if (perSubject) {
                        subj = statements[i].getSubject();
                    } else {
                        var t = statements[i].getType();
                        if (t === 'uri' || t === 'bnode') {
                            continue;
                        }
                        subj = statements[i].getValue();
                    }
                    var stmts = graph.find(subj, predicate);
                    if (stmts.length > 0) {
                        perStatement(graph, [stmts[0]]);
                    }
                }
                return perStatement(graph, []);
            },
            objects: function (predicate) {
                var nstats = [], i;
                if (perSubject === true) {
                    for (i = 0; i < statements.length; i++) {
                        nstats = nstats.concat(graph.find(statements[i].getSubject(), predicate));
                    }
                } else {
                    for (i = 0; i < statements.length; i++) {
                        var t = statements[i].getType();
                        if (t === 'uri' || t === 'bnode') {
                            nstats = nstats.concat(graph.find(statements[i].getValue(), predicate));
                        }
                    }
                }
                return perStatement(graph, nstats);
            },
            constr: function (predicate, object) {
                if (util.isString(object)) {
                    object = {type: 'uri', value: object};
                }
                var nstats = [];
                for (var i = 0; i < statements.length; i++) {
                    var subj = perSubject ? statements[i].getSubject() : statements[i].getValue();
                    if (graph.find(subj, predicate, object).length > 0) {
                        nstats.push(statements[i]);
                    }
                }
                return perStatement(graph, nstats, perSubject);
            },
            /**
             * For each match the callback will be called with a focused iterator.
             */
            each: function (callback, type) {
                if (perSubject === true) {
                    for (var i = 0; i < statements.length; i++) {
                        var subj = statements[i].getSubject();
                        var t = subj.substring(0, 2) === "_:" ? 'bnode' : 'uri';
                        if (type == null || type === t) {
                            callback(perStatement(graph, statements[i], perSubject));
                        }
                    }
                } else {
                    for (var j = 0; j < statements.length; j++) {
                        callback(perStatement(graph, statements[j], perSubject));
                    }
                }
            },
            nodes: function (type) {
                var res = [];
                if (perSubject === true) {
                    for (var i = 0; i < statements.length; i++) {
                        var subj = statements[i].getSubject();
                        var t = subj.substring(0, 2) === "_:" ? 'bnode' : 'uri';
                        if (type == null || type === t) {
                            res.push({type: t, value: statements[i].getSubject()});
                        }
                    }
                } else {
                    for (var j = 0; j < statements.length; j++) {
                        if (type == null || type === statements[j].getType()) {
                            res.push(statements[j].getObject());
                        }
                    }
                }
                return res;
            },
            values: function (type) {
                var res = [];
                if (perSubject === true) {
                    for (var i = 0; i < statements.length; i++) {
                        var subj = statements[i].getSubject();
                        var t = subj.substring(0, 2) === "_:" ? 'bnode' : 'uri';
                        if (type == null || type === t) {
                            res.push(statements[i].getSubject());
                        }
                    }
                } else {
                    for (var j = 0; j < statements.length; j++) {
                        if (type == null || type === statements[j].getType()) {
                            res.push(statements[j].getValue());
                        }
                    }
                }
                return res;
            },
            firstValue: function (type) {
                if (perSubject === true) {
                    for (var i = 0; i < statements.length; i++) {
                        var subj = statements[i].getSubject();
                        var t = subj.substring(0, 2) === "_:" ? 'bnode' : 'uri';
                        if (type == null || type === t) {
                            return statements[i].getSubject();
                        }
                    }
                } else {
                    for (var j = 0; j < statements.length; j++) {
                        if (type == null || type === statements[j].getType()) {
                            return statements[j].getValue();
                        }
                    }
                }
            }
        }
    };

    /**
     * Provides an API for accessing and manipulating an RDF Graph.
     *
     * The Graph API wraps a pure RDF JSON object to make it easy to access and manipulate on the level of rdfjson.Statements.
     * Note that for efficiency reasons the RDF JSON object will be extended, hence it will contain attributes
     * that goes beyond the specification.
     *
     * The pure RDF JSON object:
     * <ul><li>can still be inspected independently, it will contain the correct RDF expression.</li>
     *     <li>cannot be modified directly since it will conflict with manipulations via this class,
     *      the exception is the statement object attributes which can be updated.</li>
     *     <li>is now unsuitable to be communicated for instance back to a server storage
     *      due to the extra attributes. Use the exportRDFJSON function to get a clean RDF JSON object.</li></ul>
     *
     * The constructor is sheap, no indexes or additional statements are created until requested or created.
     *
     * @param {Object=} graph a pure RDF JSON object according to the specification that will be manipulated internally.
     * @param {Boolean=} validate indicates wether to validate the graph directly or not.
     * @class
     */
    var Graph = function (graph, validate) {
        this._graph = graph || {};
        /**
         * Internal index of bnodes, will never shrink after creation of this graph instance.
         * New bnodes will be added but bnodes contained in removed statements will be kept
         * in case the statement is only temporarily unasserted.
         */
        this._bnodes = {};
        /**
         * If true the graph has been iterated through and all found bnodes have been added to index.
         */
        this._bnodesIndexed = false;

        if (validate !== false) {
            this.validate();
        }
        this._changed = false;
    };

    //===================================================
    // Public API
    //===================================================
    /**
     * @return {Boolean} true if the graph contains no asserted statements.
     */
    Graph.prototype.isEmpty = function () {
        var s, p, oindex, graph = this._graph, objArr;
        for (s in graph) {
            if (graph.hasOwnProperty(s)) {
                for (p in graph[s]) {
                    if (graph[s].hasOwnProperty(p)) {
                        objArr = graph[s][p];
                        for (oindex = objArr.length - 1; oindex >= 0; oindex--) {
                            var o = objArr[oindex];
                            if (o._statement == null || o._statement.isAsserted()) {
                                return false;
                            }
                        }
                    }
                }
            }
        }
        return true;
    };

    Graph.prototype.onChange = function() {
    };

    Graph.prototype.setChanged = function(changed) {
        this._changed = changed === true || changed == null ? true : false;
        if (this._changed) {
            this.onChange();
        }
    };

    Graph.prototype.isChanged = function() {
        return this._changed;
    };

    /**
     * Adds all statements of a graph to the current graph.
     * Will create new blank nodes ids in the source graph to avoid clashes with target graph.
     *
     * @param graph
     */
    Graph.prototype.addAll = function(graph) {
        var bnodeIdx = {}, bn, stmts = graph.find();
        for (var i=0;i<stmts.length;i++) {
            var stmt = stmts[i];
            var s = stmt.getSubject();
            var p = stmt.getPredicate();
            var o = stmt.getCleanObject();

            if (s.indexOf("_:") === 0) {
                bn = bnodeIdx[s] || this._newBNode();
                bnodeIdx[s] = bn;
                s = bn;
            }
            if (p.indexOf("_:") === 0) {
                bn = bnodeIdx[p] || this._newBNode();
                bnodeIdx[p] = bn;
                p = bn;
            }
            if (o.type === "bnode") {
                bn = bnodeIdx[o.value] || this._newBNode();
                bnodeIdx[o.value] = bn;
                o.value = bn;
            }
            this.add(s, p, o);
        }
    };

    /**
     * Adds a statement to the graph, either an existing statement or creates an new one from the triple pattern.
     * If a statement instance is used it may originate from another graph, although potential bnodes are not renamed.
     *
     * @param {rdfjson/Statement|string} s either the subject in a triple pattern or a Statement instance to add,
     * in the latter case the other parameters must be undefined.
     * @param {string} p the predicate of the triple to add.
     * @param {Object|string} o the object where the attributes type, value, lang and datatype are used to describe the object.
     * @returns {rdfjson/Statement}
     */
    Graph.prototype.add = function (s, p, o) {
        if (s instanceof Statement) {
            var p = s.getPredicate(), o = s.getObject(), s = s.getSubject();
            this._trackBNodes(s, p, o);
            var o1 = this._graphObject(o);
            var o2 = util.add(this._graph, s, p, o1);
            this.setChanged();
            return this._get(s, p, o2, true);
        } else {
            return this.create(s, p, o, true);
        }
    };

    Graph.prototype.addL = function (s, p, value, lang) {
        var o = {type: "literal", value: value};
        if (typeof lang === "string") {
            o.lang = lang;
        }
        return this.create(s, p, o, true);
    };

    Graph.prototype.addD = function (s, p, value, datatype) {
        var o = {type: "literal", value: value};
        if (typeof datatype === "string") {
            o.datatype = namespaces.expand(datatype);
        }
        return this.create(s, p, o, true);
    };

    /**
     * Creates a new statement and associates it to the graph, unless assert is explicitly set to false it is also added to the graph.
     *
     * @param {String=} s the subject in the form of a uri, if undefined a new blank node is created.
     * @param {String} p the predicate in the form of a uri, if undefined a new blank node is created.
     * @param {Object} o the object in the form of an object containing
     *  the attributes: 'type', 'value', 'lang', and 'datatype'. If undefined a new blank node is created.
     *  If a string is provided it is assumed to be a url, i.e. sending in "the url" is the same as sending in {type: "uri", value: "the url"}.
     * @param {Boolean} assert indicated if the statement should be added to the graph directly. If not specified true is assumed.
     * @returns {rdfjson.Statement}
     * @see rdfjson.rdfjson#add
     */
    Graph.prototype.create = function (s, p, o, assert) {
        if (s == null) {
            s = this._newBNode();
        } else {
            s = namespaces.expand(s);
        }
        if (p == null) {
            p = this._newBNode();
        } else {
            p = namespaces.expand(p);
        }

        if (o == null) {
            o = {type: 'bnode', value: this._newBNode()};
        } else if (util.isString(o)) {
            o = {type: "uri", value: namespaces.expand(o)};
        } else {
            //The object is copied to avoid reuse of same object in multiple places of the graph
            //leading to strange updates.
            o = {type: o.type, value: o.value, lang: o.lang, datatype: o.datatype};
            if (o.type === "uri" && o.value != null) {
                o.value = namespaces.expand(o.value);
            }
            if (o.datatype) {
                o.datatype = namespaces.expand(o.datatype);
            }
        }
        if (assert !== false) {
            var o1 = util.add(this._graph, s, p, o);
            this.setChanged();
            return this._getOrCreate(s, p, o1, true);
        } else {
            return new Statement(this, s, p, o, false);
        }
    };

    /**
     * Convenience function that combines the find and remove functions.
     * @param {String=} s the subject
     * @param {String=} p the predicate
     * @param {Object=} o the object
     * @see rdfjson.find
     * @see rdfjson.remove
     */
    Graph.prototype.findAndRemove = function (s, p, o) {
        var stmts = this.find(s, p, o);
        for (var i = 0; i < stmts.length; i++) {
            this.remove(stmts[i]);
        }
    };

    /**
     * Removes the given statement from the graph.
     * If you plan to keep the statement around and assert it later,
     * it is recommended to only use the rdfjson.Statement#setAsserted method instead.
     *
     * @param {rdfjson.Statement} statement the statement to remove from the graph.
     * @see rdfjson.Statement#setAsserted
     */
    Graph.prototype.remove = function (statement) {
        var s = statement.getSubject(), p = statement.getPredicate(), o = statement.getObject();
        this._trackBNodes(s, p, o);
        if (util.remove(this._graph, s, p, o) != null) {
            this.setChanged();
        }
    };

    /**
     * Finds all statements that fulfills the given pattern. Any combination of the arguments may be left out.
     *
     * @param {String=} s the subject in the statements to be returned, undefined indicates that any subject is ok.
     * @param {String=} p the predicate in the statements to be returned, undefined indicates that any predicate is ok.
     * @param {Object=} o the object in the statements to be returned, undefined indicates that any object is ok.
     * Objets of matching statements have to be equal according to the objectEquals method.
     * @return {rdfjson.Statement[]}
     * @see rdfjson.rdfjson#objectEquals
     */
    Graph.prototype.find = function (s, p, o) {
        // none, s, p, s&p
        if (typeof s === "string") {
            s = namespaces.expand(s);
        }
        if (typeof p === "string") {
            p = namespaces.expand(p);
        }
        if (typeof o === "object" && o !== null && o.type === "uri") {
            o.value = namespaces.expand(o.value);
        } else if (typeof o === "string") {
            o = {type: "uri", value: namespaces.expand(o)};
        }
        if (o == null) {
            // none, s
            if (p == null) {
                if (s == null) {
                    return this._find();
                } else {
                    return this._findS(s);
                }
                // p, s&p
            } else {
                // p
                if (s == null) {
                    return this._findP(p);
                    // s&p
                } else {
                    return this._findSP(s, p);
                }
            }
        }
        // o, s&o
        if (p == null) {
            if (s == null) {
                return this._findO(o);
            } else {
                return this._findSO(s, o);
            }
        }

        // p&o
        if (s == null) {
            return this._findPO(p, o);
        }

        //s&p&o
        var stmt = this._get(s, p, util.contains(this._graph, s, p, o), true);
        if (stmt == null) {
            return [];
        } else {
            return [stmt];
        }
    };

    /**
     * Convenience method that returns the value of object of the first matching Statement
     * for the given subject and predicate.
     *
     * @param {String=} s the subject
     * @param {String=} p the predicate
     * @return {String} the value, may be a literal or a URI, if undefined no matching statement (and value) could be found.
     * @see rdfjson.find
     */
    Graph.prototype.findFirstValue = function (s, p) {
        var arr = this.find(s, p);
        if (arr.length > 0) {
            return arr[0].getValue();
        }
    };

    /**
     * Retrieves a projection, a plain object with simple attribute value pairs given a subject and a mapping.
     * The mapping is an object where the same attributes appear but with the predicates are values.
     * Hence, each attribute gives rise to a search for all statements with the given subject and the predicate
     * specified by the attribute.
     * The result object will contain the mapping attributes with values from the the first matched statements object value if there are any.
     * To access additional information like multiple statement or the statements (type, language, datatype)
     * a "*" prepended version of each attribute is provided that contains a list of matching Statements.
     *
     * @param {String} s the subject to use for the projection.
     * @param {Object} mapping the mapping configuration
     * @returns {Object}
     * @example
     * var proj = graph.projection("http://example.com", {
     *     "title":       "http://purl.org/dc/terms/title",
     *     "description": "http://purl.org/dc/terms/description"
     * });
     * //The object proj now has the attributes title, *title, description, and *description.
     *
     * //Accessing the title of http://example.com
     * console.log(proj.title);
     *
     * //To get hold of additional information available in the statement, for instance the language of a literal:
     * console.log(proj["*title"][0].getLanguage())
     *
     */
    Graph.prototype.projection = function (s, mapping, multipleValueStyle) {
        var mapped = {}, arr;
        for (var key in mapping) {
            if (mapping.hasOwnProperty(key)) {
                var prop = mapping[key];
                var values = this.find(s, prop);
                if (values.length > 0) {
                    if (key[0] === "*") {
                        arr = [];
                        for (var i = 0; i < values.length; i++) {
                            arr[i] = values[i].getValue();
                        }
                        mapped[key.substr(1)] = arr;
                    } else {
                        mapped[key] = values[0].getValue();
                    }
                    if (multipleValueStyle != null && multipleValueStyle !== "none") {
                        switch (multipleValueStyle) {
                            case "statement":
                                arr = values;
                                break;
                            case "objects":
                                arr = [];
                                for (var i = 0; i < values.length; i++) {
                                    arr[i] = values[i].getCleanObject();
                                }
                                break;
                            case "values":
                                arr = [];
                                for (var i = 0; i < values.length; i++) {
                                    arr[i] = values[i].getValue();
                                }
                                break;
                        }
                        mapped["*" + key] = arr;
                    }
                }
            }
        }
        return mapped;
    };

    Graph.prototype.subjects = function (p, o) {
        return perStatement(this, this.find(null, p, o), true);
    };
    Graph.prototype.subject = function (p, o) {
        return perStatement(this, zeroOrOne(this.find(null, p, o)), true);
    };

    Graph.prototype.objects = function (s, p) {
        return perStatement(this, this.find(s, p, null));
    };

    Graph.prototype.object = function (s, p) {
        return perStatement(this, zeroOrOne(this.find(s, p, null)));
    };

    /**
     * @return {Object} a plain RDF JSON object without the additional artifacts created by this Graph class.
     * The returned object is suitable for serilization and communicated with other systems.
     */
    Graph.prototype.exportRDFJSON = function () {
        var s, p, oindex, graph = this._graph, ngraph = {}, objArr, nObjArr, o, no;
        for (s in graph) {
            if (graph.hasOwnProperty(s)) {
                ngraph[s] = {};
                for (p in graph[s]) {
                    if (graph[s].hasOwnProperty(p)) {
                        objArr = graph[s][p];
                        nObjArr = ngraph[s][p] = [];
                        for (oindex = objArr.length - 1; oindex >= 0; oindex--) {
                            o = objArr[oindex];
                            no = {type: o.type, value: o.value};
                            if (o.lang != null) {
                                no.lang = o.lang;
                            }
                            if (o.datatype != null) {
                                no.datatype = o.datatype;
                            }
                            nObjArr.push(no);
                        }
                    }
                }
            }
        }
        return ngraph;
    };

    /**
     * Replaces a URI in subject position with another,
     * assuming the target URI does not exist in the graph already.
     *
     * @param sourceURI
     * @param targetURI
     * @returns {Graph}
     * @deprecated Use replaceURI instead.
     */
    Graph.prototype.replaceSubject = function(sourceURI, targetURI) {
        return this.replaceURI(sourceURI, targetURI);
    };

    /**
     * Replaces all occurences of a URI in the graph with another URI.
     * Assumes the target URI does not exist in the graph already.
     *
     * @param sourceURI
     * @param targetURI
     * @returns {Graph}
     */
    Graph.prototype.replaceURI = function(sourceURI, targetURI) {
        var graph = this._graph;
        if (graph.hasOwnProperty(sourceURI)) {
            if (!graph.hasOwnProperty((targetURI))) {
                graph[targetURI] = graph[sourceURI];
                delete graph[sourceURI];
            } else {
                throw "Cannot replace subject with target URI since it already exists.";
            }

            this._map(function(s, p, o) {
                if (o.type === "uri" && o.value === sourceURI) {
                    o.value = targetURI;
                }
                if (s === targetURI && o._statement) {
                    o._statement._s = targetURI;
                }
            });
        }

        return this;
    };

    /**
     * Clones this graph.
     * @returns {rdfjson.Graph}
     */
    Graph.prototype.clone = function () {
        return new Graph(this.exportRDFJSON());
    };

    /**
     * Finds all properties for a given subject.
     * Note: Optimal.
     * @param {String} s the subject to find properties for
     * @return {Array[String]} of strings
     */
    Graph.prototype.findProperties = function (s) {
        if (this._graph[s] == null) {
            return [];
        }
        var p, graph = this._graph, predicates = [];
        for (p in graph[s]) {
            if (graph[s].hasOwnProperty(p)) {
                predicates.push(p);
            }
        }
        return predicates;
    };

    /**
     * Validates the graph and returns a report.
     * If errors are detected an exception is thrown.
     * The validation report is a object with a valid attribute which is either false or true.
     * If it is false an array of errors are provided where each error is an object containing
     * a message and information regarding which subject,predicate and object index in the
     * rdjson javascript object that caused the error..
     *
     * @returns {undefined} if there where no errors
     * @throws {Object} the validation report.
     */
    Graph.prototype.validate = function () {
        this.report = this._validate();
        if (!this.report.valid) {
            throw(this.report);
        }
        return this.report;
    };

    /**
     * You should not use this function unless you are VERY certain of what you are doing.
     *
     * @param {String} bNodeId
     */
    Graph.prototype.registerBNode = function (bNodeId) {
        this._bnodes[bNodeId] = true;
    };

    //===================================================
    // Private methods
    //===================================================

    /**
     * If the object already contains a statement that is returned, otherwise a new is created.
     * If the object is not specified undefined is returned.
     * @return {Statement|undefined} a statement that belongs to this graph.
     */
    Graph.prototype._get = function (s, p, o, asserted) {
        if (o == null) {
            return;
        }

        return this._getOrCreate(s, p, o, asserted);
    };

    /**
     * If the object already contains a statement that is returned, otherwise a new is created.
     * @return {rdfjson.Statement} a statement that belongs to this graph.
     */
    Graph.prototype._getOrCreate = function (s, p, o, asserted) {
        if (o._statement == null) {
            new Statement(this, s, p, o, asserted);
        }
        return o._statement;
    };


    /**
     * @return {Object} if the object originates from another graph a copy is made.
     */
    Graph.prototype._graphObject = function (o) {
        if (o._statement == null ||
            o._statement._graph === this) {
            return o;
        }
        return {type: o.type, value: o.value, lang: o.lang, datatype: o.datatype};
    };

    /**
     * Finds all statements with a given subject and object.
     * @param {String} s
     * @param {String} p
     * @returns {rdfjson.Statement[]}
     */
    Graph.prototype._findSP = function (s, p) {
        if (this._graph[s] == null || this._graph[s][p] == null) {
            return [];
        }
        var arr = [], objs = this._graph[s][p];
        for (var i = 0; i < objs.length; i++) {
            arr[i] = this._get(s, p, objs[i], true);
        }
        return arr;
    };

    /**
     * Finds all statements with a given subject.
     * Note: Optimal.
     * @param {String} s
     * @returns {rdfjson.Statement[]}
     */
    Graph.prototype._findS = function (s) {
        if (this._graph[s] == null) {
            return [];
        }
        var p, graph = this._graph, spArrs = [];
        for (p in graph[s]) {
            if (graph[s].hasOwnProperty(p)) {
                spArrs.push(this._findSP(s, p));
            }
        }
        return Array.prototype.concat.apply([], spArrs);
    };

    /**
     * Generates statements for the entire graph.
     * Note: Optimal.
     * @returns {rdfjson.Statement[]}
     */
    Graph.prototype._find = function () {
        var arr = [], that = this;
        this._map(function (s1, p1, o1) {
            arr.push(that._get(s1, p1, o1, true));
        });
        return arr;
    };

    /**
     * Finds all statements with a given predicate.
     * Note: Close to optimal without further indexing, to many checks due to iteration via _map.
     * @param {String} p
     * @returns {rdfjson.Statement[]}
     */
    Graph.prototype._findP = function (p) {
        var arr = [], that = this;
        this._map(function (s1, p1, o1) {
            if (p === p1) {
                arr.push(that._get(s1, p1, o1, true));
            }
        });
        return arr;
    };

    /**
     * Iterates through all statements to find those with specified object.
     * Note: Optimal without additional indexing.
     * @param {Object} o
     * @returns {rdfjson.Statement[]}
     */
    Graph.prototype._findO = function (o) {
        var arr = [], that = this;
        this._map(function (s1, p1, o1) {
            if (util.objectEquals(o, o1)) {
                arr.push(that._get(s1, p1, o1, true));
            }
        });
        return arr;
    };

    /**
     * Finds all statements with a given subject and object.
     * Note: Close to optimal without further indexing, to many checks due to iteration via _map.
     * @returns {rdfjson.Statement[]}
     */
    Graph.prototype._findSO = function (s, o) {
        var arr = [], that = this;
        this._map(function (s1, p1, o1) {
            if (s === s1 && util.objectEquals(o, o1)) {
                arr.push(that._get(s1, p1, o1, true));
            }
        });
        return arr;
    };

    /**
     * Finds all statements with a given predicate and object.
     * Note: Close to optimal without further indexing, to many checks due to iteration via _map.
     * @returns {rdfjson.Statement[]}
     */
    Graph.prototype._findPO = function (p, o) {
        var arr = [], that = this;
        this._map(function (s1, p1, o1) {
            if (p === p1 && util.objectEquals(o, o1)) {
                arr.push(that._get(s1, p1, o1, true));
            }
        });
        return arr;
    };

    /**
     * Iterates through all statements of the graph and calls the provided function on them.
     *
     * @param {Function} f are called for each statement with the three arguments
     *  (in order) subject, predicate, and object.
     */
    Graph.prototype._map = function (f) {
        var s, p, oindex, graph = this._graph, objArr;
        for (s in graph) {
            if (graph.hasOwnProperty(s)) {
                for (p in graph[s]) {
                    if (graph[s].hasOwnProperty(p)) {
                        objArr = graph[s][p];
                        for (oindex = objArr.length - 1; oindex >= 0; oindex--) {
                            f(s, p, objArr[oindex]);
                        }
                    }
                }
            }
        }
    };

    Graph.prototype._validate = function () {
        var s, p, oindex, graph = this._graph, objArr, report = {valid: true, errors: [], nr: 0};
        for (s in graph) {
            if (graph.hasOwnProperty(s)) {
                if (!util.isObject(graph[s])) {
                    report.errors.push({s: s, message: "Subject must point to an object."});
                    report.valid = false;
                    continue;
                }
                for (p in graph[s]) {
                    if (graph[s].hasOwnProperty(p)) {
                        objArr = graph[s][p];
                        if (!util.isArray(objArr)) {
                            report.errors.push({s: s, p: p, message: "Predicate must point to an array of objects."});
                            report.valid = false;
                            continue;
                        }

                        for (oindex = objArr.length - 1; oindex >= 0; oindex--) {
                            var o = objArr[oindex];
                            if (!util.isObject(o)) {
                                report.errors.push({s: s, p: p, oindex: (oindex + 1), message: "Element " + (oindex + 1) + " in object array is not an object."});
                                report.valid = false;
                                continue;
                            }
                            if (o.type == null) {
                                report.errors.push({s: s, p: p, oindex: (oindex + 1), message: "Object " + (oindex + 1) + " in object array lacks the attribute type, must be either 'literal', 'resource' or 'bnode'."});
                                report.valid = false;
                                continue;
                            }
                            if (!util.isString(o.value)) {
                                report.errors.push({s: s, p: p, oindex: (oindex + 1), message: "Object " + (oindex + 1) + " in object array must have the 'value' attribute pointing to a string."});
                                report.valid = false;
                                continue;
                            }
                            report.nr++;
                        }
                    }
                }
            }
        }
        return report;
    };

    /**
     * Creates a new bnode that is unique in the current graph.
     * Bnodes in temporarily unasserted statements (currently removed from the graph)
     * are avoided as well.
     * @returns {String}
     */
    Graph.prototype._newBNode = function () {
        this._indexBNodes();
        var p, n, bnode;
        for (p = 1; p < 10; p++) {
            for (n = 1; n <= p; n++) {
                bnode = "_:" + Math.floor(Math.random() * (Math.pow(10, p) + 1));
                if (this._bnodes[bnode] !== true) {
                    this._bnodes[bnode] = true;
                    return bnode;
                }
            }
        }
    };

    /**
     * Adds the bnodes in the graph to the bnode index.
     * The index can be calculated late, just before the first call to create.
     * (Bnodes in statements that are removed are added in advance to the index as
     * they may be only temporarily unasserted and when they are asserted again
     * they should not overlap with newly created bnodes.)
     * After the index is created all statemnts added update the index.
     */
    Graph.prototype._indexBNodes = function () {
        if (this._bnodesIndexed) {
            return;
        }
        var s, p, oindex, graph = this._graph, objArr;
        for (s in graph) {
            if (graph.hasOwnProperty(s)) {
                if (s.indexOf("_:") === 0) {
                    this._bnodes[s] = true;
                }
                for (p in graph[s]) {
                    if (graph[s].hasOwnProperty(p)) {
                        if (p.indexOf("_:") === 0) {
                            this._bnodes[p] = true;
                        }
                        objArr = graph[s][p];
                        for (oindex = objArr.length - 1; oindex >= 0; oindex--) {
                            if (objArr[oindex].type === "bnode") {
                                this._bnodes[objArr[oindex].value] = true;
                            }
                        }
                    }
                }
            }
        }
        this._bnodesIndexed = true;
    };

    /**
     * Adds any bnodes in the given parameters to the index (the index may still be incomplete).
     * @param {String} s the subject in a statement.
     * @param {String} p the predicate in a statement.
     * @param {Object} o the object in a statement.
     */
    Graph.prototype._trackBNodes = function (s, p, o) {
        if (s.indexOf("_:") === 0) {
            this._bnodes[s] = true;
        }
        if (p.indexOf("_:") === 0) {
            this._bnodes[p] = true;
        }
        if (o.type === "bnode") {
            this._bnodes[o.value] = true;
        }
    };
    return Graph;
});

},
'rdfjson/formats/rdfjson/util':function(){
/*global define,rdfjson*/
define([], function () {

    var exports = {};

    //Four helper methods, from dojo.
    exports.isObject = function (it) {
        return it !== undefined &&
            (it === null || typeof it == "object" || exports.isArray(it) || exports.isFunction(it)); // Boolean
    };
    exports.isString = function (it) {
        return (typeof it == "string" || it instanceof String); // Boolean
    };

    exports.isArray = function (it) {
        return it && (it instanceof Array || typeof it == "array"); // Boolean
    };

    exports.isFunction = function (it) {
        return Object.prototype.toString.call(it) === "[object Function]";
    };


    exports.statementEquals = function (s1, s2) {
        return s1.s === s2.s && s1.p === s2.p && exports.objectEquals(s1.o, s2.o);
    };

    /**
     * Adds a statement to a graph object according to the rdf/json specification.
     * Duplicates of the same statement are not allowed in a graph,
     * hence they are not allowed to be added.
     *
     * The object in the statement are represented via an javascript object containing:
     * <ul><li>type - one of 'uri', 'literal' or 'bnode' (<b>required</b> and must be lowercase).</li>
     * <li>value - the lexical value of the object (<b>required</b>, full URIs should be used, not namespaced using abbreviations)</li>
     * <li>lang - the language of a literal value (<b>optional</b> but if supplied it must not be empty)</li>
     * <li>datatype - the datatype URI of the literal value (<b>optional</b>)</li>
     * The 'lang' and 'datatype' keys should only be used if the value of the 'type' key is "literal".
     *
     * @param {Object} graph according to the rdf/json specification.
     * @param {String} s a URI representing the subject in a statement.
     * @param {String} p a URI representing the predicate in a statement.
     * @param {Object} o an object representing either a resource or a literal,
     *  see format described above.
     * @return {Object} the javascript object corresponding to the statements object just added,
     *  note that it might be a clone of the object given in the parameter o
     * (for instance when the statement already exists in the graph).
     * @throws {String} an error message if the arguments are not valid.
     * @see The <a href="http://n2.talis.com/wiki/RDF_JSON_Specification">RDF JSON Specification</a>.
     */
    exports.add = function (graph, s, p, o) {
        exports.checkForWrongArgs(arguments);
        if (graph[s] === undefined) {
            graph[s] = {};
            graph[s][p] = [o];
            return o;
        }
        if (graph[s][p] === undefined) {
            graph[s][p] = [o];
            return o;
        }
        var i, objs = graph[s][p];
        for (i = objs.length - 1; i >= 0; i--) {
            if (exports.objectEquals(o, objs[i])) {
                return objs[i];
            }
        }
        objs.push(o);
        return o;
    };

    /**
     * Tries to remove the specified statement from the given graph.
     * If it is successful it returns the object of the statment removed.
     *
     * @param {Object} graph
     * @param {Object} s
     * @param {Object} p
     * @param {Object} o
     * @return {Object|undefined} the object of the statement removed,
     *  undefined if no matching statement could be removed.
     * @throws {String} an error message if the arguments are not valid.
     * @see exports.add for a longer treatment of the allowed arguments.
     */
    exports.remove = function (graph, s, p, o) {
        exports.checkForWrongArgs(arguments);
        if (graph[s] === undefined || graph[s][p] === undefined) {
            return;
        }
        var i, objs = graph[s][p];
        for (i = objs.length - 1; i >= 0; i--) {
            if (exports.objectEquals(o, objs[i])) {
                o = objs[i];
                objs.splice(i, 1);
                exports.cleanup(graph, s, p);
                return o;
            }
        }
    };

    /**
     * Checks if the graph contains the specified statement.
     *
     * @param {Object} graph
     * @param {String} s
     * @param {String} p
     * @param {Object} o
     * @return {Object|undefined} the object of the found statement if the graph contains the specified statement, undefined otherwise.
     * @throws {String} an error message if the arguments are not valid.
     */
    exports.contains = function (graph, s, p, o) {
        exports.checkForWrongArgs(arguments);
        if (graph[s] === undefined || graph[s][p] === undefined) {
            return;
        }
        var i, objs = graph[s][p];
        for (i = objs.length - 1; i >= 0; i--) {
            if (exports.objectEquals(o, objs[i])) {
                return objs[i];
            }
        }
    };

    /**
     * Removes empty structures in the graph for the given subject and predicate.
     * It checks if there are subjects without outgoing properties or
     * if there are properties with no objects.
     *
     * Note that the need for this function is a consequence of the normalized character
     * of the RDF JSON format.
     *
     * @param {Object} graph
     * @param {Object} s
     * @param {Object} p
     */
    exports.cleanup = function (graph, s, p) {
        if (graph[s][p].length === 0) {
            delete graph[s][p];
            var hasProp = false;
            for (var prop in graph[s]) {
                if (graph[s].hasOwnProperty(prop)) {
                    hasProp = true;
                    break;
                }
            }
            if (!hasProp) {
                delete graph[s];
            }
        }
    };

    /**
     * Checks the arguments for the add function are valid
     * (and all other functions that have the same signature).
     *
     * @param {Array} args an array of the arguments for the add function.
     * @throws {String} with a message if the arguments are not valid.
     * @see exports.add
     */
    exports.checkForWrongArgs = function (args) {
        if (!exports.isObject(args[0])) {
            throw "Graph is not a object.";
        } else if (!exports.isString(args[1])) {
            throw "Subject is not a string.";
        } else if (!exports.isString(args[2])) {
            throw "Predicate is not a string.";
        } else if (!exports.isObject(args[3])) {
            throw "Object is not a object.";
        } else if (args[3].type === undefined) {
            throw "Object has no type attribute, must be one of 'uri', 'literal', or 'bnode'";
        } else if (args[3].value === undefined) {
            throw "Object has no value attribute corresponding to the lexical value of the object.";
        }
        //TODO check that subject, predicate and object.datatype are uris. Also check that object.value is a URI if the type is uri.
    };

    /**
     * Compares two statement objects according to the RDF JSON Specification.
     * If both o1 and o2 are strings they are simply compared.
     * If one of o1 and o2 are a string and the other is an object the string is compared with the value of the object ignoring any other attributes of the object.
     * If both o1 and o2 are null or undefined they are considered equal.
     *
     * @param {*} o1
     * @param {*} o2
     * @return {Boolean} true if they have the same type, lexical value, language, and datatype.
     */
    exports.objectEquals = function (o1, o2) {
        if (o1 === o2 || (o1 == null && o1 == o2)) {
            return true;
        }
        //Note, using
        if (exports.isString(o1)) {
            if (exports.isString(o2)) {
                return o1 === o2;
            } else {
                return o1 ===  o2.value;
            }
        } else if (exports.isString(o2)) {
            return o1.value === o2;
        } else {
            return o1.type === o2.type && o1.value === o2.value && o1.lang === o2.lang && o1.datatype === o2.datatype;
        }
    };

    exports.findDirectOrRDFValue = function (graph, subject, predicate) {
        var arr = graph.find(subject, predicate);
        if (arr.length > 0) {
            if (arr[0].getType() != "bnode") {
                return arr[0].getValue();
            } else {
                return graph.findFirstValue(arr[0].getValue(), "http://www.w3.org/1999/02/22-rdf-syntax-ns#value");
            }
        }
    };
    return exports;
});
},
'rdfjson/Statement':function(){
/*global define*/
define(["./namespaces"], function (namespaces) {

    /**
     * rdfjson.Statement Represents a statement in a graph.
     * Never create directly, use the methods in rdfjson.Graph.
     * Constructs a statement from the provided parts, the object is assumed to be the same actual javascript object as is used in the graph.
     *
     * @param {rdfjson.Graph} graph the rdfjson.Graph we will manipulate.
     * @param {String} s the subject in the statement
     * @param {String} p the predicate in the statement.
     * @param {Object} o the object in the statement.
     * @param {Boolean} asserted indicates if the statement is asserted in the accompanied graph.
     * @class
     */
    var Statement = function (graph, s, p, o, asserted) {
        this._graph = graph;
        this._s = s;
        this._p = p;
        this._o = o;
        this._o._statement = this;
        this._asserted = asserted;
    };

    //===================================================
    // Public API
    //===================================================
    /**
     * The Graph this Statement is associated with.
     * @returns {rdfjson.Graph}
     */
    Statement.prototype.getGraph = function () {
        return this._graph;
    };

    /**
     * An asserted statement is present in its associated Graph
     * @param {Boolean} asserted
     */
    Statement.prototype.setAsserted = function (asserted) {
        if (asserted != this._asserted) {
            if (asserted) {
                this._graph.add(this);
            } else {
                this._graph.remove(this);
            }
            this._asserted = asserted;
        }
    };

    /**
     * True if the Statement is asserted in the Graph.
     * @returns {Boolean}
     */
    Statement.prototype.isAsserted = function () {
        return this._asserted;
    };

    /**
     * The subject of this statement.
     * @returns {String}
     */
    Statement.prototype.getSubject = function () {
        /**
         * @type {String}
         * @private
         */
        this._s;
        return this._s;
    };

    Statement.prototype.isSubjectBlank = function() {
        if (this._sIsBlank !== true && this._sIsBlank !== false) {
            this._sIsBlank = this._graph._bnodes[this._s] === true;
        }
        return this._sIsBlank;
    };

    /**
     * Sets the subject of this statement, other Statements with this resource as subject or object is not affected.
     * @param {String} s must be a valid URI.
     */
    Statement.prototype.setSubject = function (s) {
        s = namespaces.expand(s);
        if (this._asserted) {
            this._graph.remove(this);
            this._s = s;
            this._graph.add(this);
            delete this._sIsBlank;
        } else {
            this._s = s;
        }
    };

    /**
     * The predicate of this Statement.
     * @returns {String}
     */
    Statement.prototype.getPredicate = function () {
        return this._p;
    };

    /**
     * Sets the predicate of this statement.
     * @param {String} p must be a valid URI.
     */
    Statement.prototype.setPredicate = function (p) {
        p = namespaces.expand(p);
        if (this._asserted) {
            this._graph.remove(this);
            this._p = p;
            this._graph.add(this);
        } else {
            this._p = p;
        }
    };
    /**
     * The object of the Statement.
     *
     * @returns {Object}
     */
    Statement.prototype.getObject = function () {
        return this._o;
    };

    /**
     * The object of the Statement.
     *
     * @returns {Object}
     */
    Statement.prototype.getCleanObject = function () {
        var _o = this._o, o = {
            "value": _o["value"],
            "type": _o["type"]
        };
        if (_o.language) {
            o.language = _o.language;
        }
        if (this._o.datatype) {
            o.datatype = _o.datatype;
        }
        return o;
    };

    /**
     * @returns {String} one of uri, bnode and literal
     */
    Statement.prototype.getType = function () {
        return this._o["type"];
    };

    /**
     * @param {String} type must be one of uri, bnode and literal.
     */
    Statement.prototype.setType = function (type) {
        throw "Changing the type of an object is not supported, create a new statement instead.";
    };

    /**
     * If type is uri it is a URI, if type is a literal it is the literal string.
     * If type is a bnode the value is a internal bnode identity, should only be used for references within the current graph.
     * @returns {String}
     */
    Statement.prototype.getValue = function () {
        return this._o.value;
    };

    /**
     * Sets the uri, literal or bnode of the current Statement depending on the type.
     * @param {String} value must be a uri if the type so indicates.
     */
    Statement.prototype.setValue = function (value) {
        if (value !== this._o.value) {
            this._o.value = value;
            if (this.isAsserted()) {
                this._graph.setChanged();
            }
        }
    };

    /**
     * @returns {String} a language expressed using RFC-3066
     */
    Statement.prototype.getLanguage = function () {
        return this._o.lang;
    };

    /**
     * Sets the language of the object, only acceptable if the type is literal.
     * @param {String} lang the language expressed using RFC-30-66
     */
    Statement.prototype.setLanguage = function (lang) {
        if (this._o.type !== 'literal') {
            throw "Cannot set the language for a resource, has to be a literal";
        }
        if (this._o.lang !== lang) {
            this._o.lang = lang;
            if (this.isAsserted()) {
                this._graph.setChanged();
            }
        }
    };

    /**
     * The datatype of this object, only acceptable if the type is literal.
     * @returns {String} the datatype is always represented via a URI.
     */
    Statement.prototype.getDatatype = function () {
        return this._o.datatype;
    };

    /**
     * Set the datatype, only acceptable if the type is literal and no language is set.
     * @param {String} datatype the datatype expressed as a URI.
     */
    Statement.prototype.setDatatype = function (datatype) {
        if (this._o.type !== 'literal' || this._o.lang != null) {
            throw "Cannot set the datatype for a resource, has to be a literal";
        }
        if (this._o.datatype !== datatype) {
            this._o.datatype = datatype;
            if (this.isAsserted()) {
                this._graph.setChanged();
            }
        }
    };

    return Statement;
});
},
'rdfjson/namespaces':function(){
/*global define*/
define(["exports"], function (exports) {
    var nss = {
        ical: "http://www.w3.org/2002/12/cal/ical#",
        vcard: "http://www.w3.org/2006/vcard/ns#",
        dcterms: "http://purl.org/dc/terms/",
        skos: "http://www.w3.org/2004/02/skos/core#",
        rdfs: "http://www.w3.org/2000/01/rdf-schema#",
        rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
        owl: "http://www.w3.org/2002/07/owl#",
        vs: "http://www.w3.org/2003/06/sw-vocab-status/ns#",
        foaf: "http://xmlns.com/foaf/0.1/",
        wot: "http://xmlns.com/wot/0.1/",
        dc: "http://purl.org/dc/elements/1.1/",
        xsd: "http://www.w3.org/2001/XMLSchema#"
    };
    var nscounter = 0;
    var _nsify = function(ns, expanded, localname) {
        if (!nss[ns]) {
            nss[ns] = expanded;
        }
        return {
            abbrev: ns,
            ns: expanded,
            localname: localname,
            full: expanded+localname,
            pretty: ns+":"+localname
        };
    }

    exports.nsify = function(uri) {
        for (var ns in nss) {
            if (uri.indexOf(nss[ns]) === 0) {
                return _nsify(ns, nss[ns], uri.substring(nss[ns].length));
            }
        }
        var slash = uri.lastIndexOf("/");
        var hash = uri.lastIndexOf("#");
        if (hash> slash) {
            slash = hash;
        }
        nscounter++;
        return _nsify("ns"+nscounter, uri.substring(0,slash+1),uri.substring(slash+1));
    };

    exports.shorten = function(uri) {
        return exports.nsify(uri).pretty;
    };

    exports.expand = function(str) {
        var arr = str.split(":");
        if (arr.length === 2 && nss.hasOwnProperty(arr[0])) {
            return nss[arr[0]]+arr[1];
        }
        return str;
    };

    exports.add = function(ns, full) {
        if (typeof ns === "string") {
            nss[ns] = full;
        } else if (typeof ns === "object") {
            for (var key in ns) if (ns.hasOwnProperty(key)) {
                nss[key] = ns[key];
            }
        }
    };

    exports.registry = function() {
        return nss;
    };

    return exports;
});

},
'rdforms/template/ItemStore':function(){
/*global define*/
define(["dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/_base/array",
    "dojo/request",
    "./Bundle",
    "./Group",
    "./PropertyGroup",
    "./Text",
    "./Choice",
    "./OntologyStore",
    "./Converter",
    "../model/Engine"
], function (declare, lang, array, request, Bundle, Group, PropertyGroup, Text, Choice, OntologyStore, Converter, Engine) {

    /**
     * Keeps a registry of templates and reusable items.
     * Use the createTemplate method to create templates from a source
     * json structure, if the structure contains reusable items they are
     * created and stored separately as well.
     */
    return declare(null, {
        automaticSortAllowed: true,
        ignoreMissingItems: true,
        //===================================================
        // Private Attributes
        //===================================================
        _bundles: null,
        _registry: null,
        _registryByProperty: null,
        _ontologyStore: null,

        //===================================================
        // Public API
        //===================================================
        getTemplate: function (id) {
            return this.getItem(id);
        },
        getChildren: function (group, original) {
            if (group == null) {
                return [];
            }
            var origSource = group.getSource(true);
            var origSourceContent = origSource.content || origSource.items || [];
            if (original) {
                return this._createItems(origSourceContent, group._forceChildrenClones, group.getBundle());
            } else {
                var ext = this.getItem(origSource["extends"]);
                if (ext) {
                    return ext.getChildren().concat(group.getChildren(true));
                } else {
                    return group.getChildren(true);
                }
            }
        },
        getItem: function (id) {
            if (id != null) {
                return this._registry[id];
            }
        },
        getItems: function () {
            var arr = [];
            for (var key in this._registry) {
                if (this._registry.hasOwnProperty(key)) {
                    arr.push(this._registry[key]);
                }
            }
          /*  for (var key in this._registryByProperty) {
                if (this._registryByProperty.hasOwnProperty(key)) {
                    var item = this._registryByProperty[key]
                    if (item.getId() == null) {
                        arr.push(item);
                    }
                }
            }*/
            return arr;
        },
        renameItem: function(from, to) {
            if (this._registry[to]) {
                throw "Cannot rename to "+ to + " since an item with that id already exists.";
            }
            if (to === "" || to === null) {
                throw "Cannot give an item an empty string or null as id.";
            }
            var item = this._registry[from];
            if (item) {
                delete this._registry[from];
                this._registry[to] = item;
                item.setId(to);
            }
            var renameInGroup = function(source) {
                var children = source.content;
                if (children) {
                    for (var j=0;j<children.length;j++) {
                        var child = children[j];
                        if (child.id === from || child["@id"] === from) {
                            child.id = to;
                            delete child["@id"]; //Clean up backward compatability.
                        }
                        if (child.content) {
                            renameInGroup(child);
                        }
                    }
                }
            }

            var items = this.getItems();
            for (var i=0;i<items.length;i++) {
                var childItem = items[i];
                if (childItem instanceof Group) {
                    renameInGroup(childItem._source);
                }
            }
        },
        getItemIds: function () {
            var arr = [];
            for (var key in this._registry) {
                if (this._registry.hasOwnProperty(key)) {
                    arr.push(key);
                }
            }
            return arr;
        },
        getItemByProperty: function (property) {
            return this._registryByProperty[property];
        },
        detectTemplate: function (graph, uri, requiredItems) {
            return Engine.constructTemplate(graph, uri, this, requiredItems);
        },

        /**
         * Bundle is an object containing:
         * path - can be a relative or absolute path to where the templates are/will be loaded from, optional.
         * source - a RDForms template object, mandatory.
         *
         * @param {Object} bundleSrc
         * @return {Bundle} the created bundle.
         */
        registerBundle: function(bundle) {
            bundle.itemStore = this;
            var b = new Bundle(bundle);
            this._bundles.push(b);

            var templates = bundle.source.templates || bundle.source.auxilliary;
            if (templates instanceof Array) {
                this._createItems(templates, false, b);
            }
            if (typeof bundle.source.cachedChoices === "object") {
                this._ontologyStore.importRegistry(bundle.source.cachedChoices);
            }

            return b;
        },
        getBundles: function() {
            return this._bundles;
        },

        //Backward compatability
        createTemplate: function (source) {
            var b = this.registerBundle({source: source});
            return b.getRoot();
        },
        createTemplateFromChildren: function (children) {
            var childrenObj = array.map(children || [], function (child) {
                return typeof child === "string" ? this.getItem(child) : child;
            }, this);
            return new Group({source: {}, children: childrenObj, itemStore: this});
        },
        setPriorities: function (priorities) {
            this.priorities = priorities;
        },
        populate: function (configArr, callback) {
            var countdown = configArr.length;
            var down = function () {
                countdown--;
                if (countdown === 0) {
                    callback();
                }
            }
            array.forEach(configArr, function (config) {
                if(lang.isString(config) || config.type === "sirff") {
                    var url = lang.isString(config) ? config : config.url;
                    request.get(url, {
                        handleAs: "json"
                    }).then(lang.hitch(this, function (data) {
                            this.createTemplate(data);
                            down();
                        }), down);
                } else if (config.type === "exhibit") {
                    var converter;
                    if (converter == null) {
                        converter = new Converter(this);
                    }
                    converter.convertExhibit(config.url, down);
                }
            }, this);
        },

        createExtendedSource: function(origSource, extSource) {
            var newSource = lang.mixin(lang.clone(origSource), extSource);
            newSource["_extendedSource"] = extSource;
            newSource["extends"] = null; //Avoid infinite recursion when creating the fleshed out item.
            delete newSource["children"];
            return newSource;
        },

        /**
         * At a minimum the source must contain a type, the rest can be changed later.
         *
         * @param source
         * @returns {*}
         */
        createItem: function (source, forceClone, skipRegistration, bundle) {
            var item, id = source.id || source["@id"], type = source["type"] || source["@type"];
            if (source["extends"]) {
                //Explicit extends given
                var extItem = this._registry[source["extends"]];
                if (extItem == null && !this.ignoreMissingItems) {
                    throw "Cannot find item to extend with id: " + source["extends"];
                }
                if (extItem) {
                    var newSource = this.createExtendedSource(extItem.getSource(), source);
                    return this.createItem(newSource, false, false, bundle);
                }
            }

            if (type != null) {
                //If there is a type in the source then it means that the object is a new item.
                switch (type) {
                    case "text":
                        item = new Text({source: source, itemStore: this, bundle: bundle});
                        break;
                    case "choice":
                        item = new Choice({source: source, itemStore: this, ontologyStore: this._ontologyStore, bundle: bundle});
                        break;
                    case "group":
                        item = new Group({source: source, children: null, itemStore: this, bundle: bundle}); //Lazy loading of children.
                        break;
                    case "propertygroup":
                        item = new PropertyGroup({source: source, children: null, itemStore: this, bundle: bundle}); //Lazy loading of children.
                        break;
                }
                if (skipRegistration !== true) {
                    if (source.property != null) {
                        this._registryByProperty[source.property] = item;
                        if (this.priorities && this.priorities[source.property] != null) {
                            item.priority = this.priorities[source.property];
                        }
                    }
                    if (id != null && this._registry[id] == null) {
                        this._registry[id] = item;
                        if (bundle != null) {
                            bundle.addItem(item);
                        }
                    }
                }
                return item;
            } else {
                //No type means it is a reference, check that the referred item (via id) exists
                if (id === undefined) {
                    throw "Cannot create subitem, 'type' for creating new or 'id' for referencing external are required.";
                }
                if (this._registry[id] === undefined) {
                    throw "Cannot find referenced subitem using identifier: " + id;
                }
                //Check if there are any overlay properties, if so force clone mode.
                for (var key in source) {
                    if (source.hasOwnProperty(key) && (key !== "id" && key !== "@id")) {
                        forceClone = true;
                        break;
                    }
                }

                if (forceClone === true) {
                    var newSource = lang.mixin(lang.clone(this._registry[id]._source), source);
                    return this.createItem(newSource, false, true);
                } else {
                    return this._registry[id];
                }
            }
        },
        removeItem: function(item, removereferences) {
            var b = item.getBundle();
            if (b != null) {
                b.removeItem(item);
            }
            if (item.getId() != null) {
                delete this._registry[item.getId()];
            }
            var prop = item.getProperty();
            if (prop != null && this._registryByProperty[prop] === item) {
                delete this._registryByProperty[prop];
            }
            if (removereferences) {
                //TODO

            }
        },

        //===================================================
        // Inherited methods
        //===================================================
        constructor: function (ontologyStore) {
            this._bundles = [];
            this._registry = {};
            this._registryByProperty = {};
            this._ontologyStore = ontologyStore || new OntologyStore();
        },

        //===================================================
        // Private methods
        //===================================================
        _createItems: function (sourceArray, forceClone, bundle) {
            return array.map(sourceArray, function (child, index) {
                if (lang.isString(child)) {  //If child is not a object but a direct string reference, create a object.
                    child = sourceArray[index] = {id: child};
                }
                return this.createItem(child, forceClone, false, bundle);
            }, this);
        }
    });
});
},
'rdforms/template/OntologyStore':function(){
/*global define*/
define(["dojo/_base/declare"], function(declare) {

    /**
     * Simple store of ontologies to allow reuse across templates and items. 
     */
    return declare(null, {
	//===================================================
	// Private attributes
	//===================================================
	_registry: null,
	
	//===================================================
	// Public API
	//===================================================	
	importRegistry: function(registry) {
		dojo.mixin(this._registry, registry);
	},
	getChoices: function(choiceItem, callback) {
		var choices = this._findChoices(choiceItem);
		if (choices == null) {
			//TODO load via xhr and deferred.
		} else {
			if (callback == null) {
				return choices;
			} else {
				callback(choices);				
			}
		}
	},

	//===================================================
	// Inherited methods
	//===================================================
	constructor: function() {
		this._registry = {};
	},
	//===================================================
	// Private methods
	//===================================================
	_findChoices: function(item) {
		var ontologyChoiceArr = this._registry[item.getOntologyUrl()];
		if (ontologyChoiceArr != null) {
			for (var ind = 0; ind < ontologyChoiceArr.length;ind++) {
				var obj = ontologyChoiceArr[ind];
				if (this._objEqual(obj.constraints, item.getConstraints()) &&
					item.getParentProperty() == obj.parentProperty &&
					item.getHierarchyProperty() == obj.hierarchyProperty &&
					item.isParentPropertyInverted() == (obj.isParentPropertyInverted || false) &&
					item.isHierarchyPropertyInverted() == (obj.isHierarchyPropertyInverted || false)) {
					return obj.choices;
				}
			}
		} 
	},
	_objEqual: function(obj1, obj2) {
		var keys = {};
		for (var key in obj1) {
			if (obj1.hasOwnProperty(key)) {
				var val1 = obj1[key], val2 = obj2[key];
				if (dojo.isObject(val1) && dojo.isObject(val2)) {
					if (!this._objEqual(val1, val2)) {
						return false;
					}
				} else if (obj1[key] !== obj2[key]) {
					return false;
				}				
			}
			keys[key] = true;
		}
		for (var key in obj2) {
			if (keys[key] !== true && obj2.hasOwnProperty(key)) {
				var val1 = obj1[key], val2 = obj2[key];
				if (dojo.isObject(val1) && dojo.isObject(val2)) {
					if (!this._objEqual(val1, val2)) {
						return false;
					}
				} else if (obj2[key] !== obj1[key]) {
					return false;
				}
			}
		}
		return true;
	},
	_constructLoadUrl: function(choiceItem) {
		var params = [];
		params.push("constr="+encodeURIComponent(dojo.toJson(choiceItem.getConstraints())));
		if (choiceItem.getParentProperty() != null) {
			var pp = choiceItem.isParentPropertyInverted() === true ? "ipp=" : "pp=";
			params.push(pp+encodeURIComponent(choiceItem.getParentProperty()));
		}
		if (choiceItem.getHierarchyProperty() != null) {
			var hp = choiceItem.isHierarchyPropertyInverted() === true ? "ihp=" : "hp=";
			params.push(hp+encodeURIComponent(choiceItem.getHierarchyProperty()));
		}
		return choiceItem.getOntologyUrl()+"?"+params.join("&");
	}
    });
});
},
'rdforms/template/Converter':function(){
/*global define*/
define(["dojo/_base/declare"], function(declare) {

    /**
     * Keeps a registry of templates and reusable items.
     * Use the createTemplate method to create templates from a source
     * json structure, if the structure contains reusable items they are
     * created and stored separately as well. 
     */
    return declare(null, {
	//===================================================
	// Private Attributes
	//===================================================
	
	//===================================================
	// Public API
	//===================================================
	/**
	 * Converts an exhibit and loads properties and classes as 
	 * items into the ItemStore.
	 * The result, as returned in the callback function, will be
	 * an object with two arrays of items, one corresponding to 
	 * found properties and one corresponding to found classes:
	 * {
	 * 	   properties: [item1, item2],
	 *     classes: [item3, item4]
	 * } 
	 * 
	 * @param {String} url from where the exhibit will be loaded 
	 * @param {Function} callback will be called with the converted exhibit.
	 */
	convertExhibit: function(url, callback) {
		this._load(url, dojo.hitch(this, function(data) {
			callback(this._convertExhibit(data));
		}));
	},
	//===================================================
	// Inherited methods
	//===================================================
	constructor: function(itemStore) {
		this._itemStore = itemStore;
	},
	
	//===================================================
	// Private methods
	//===================================================
	_load: function(url, callback) {
		var xhrArgs = {
			url: url,
			sync: true,
			handleAs: "json-comment-optional"
		};
		var req = dojo.xhrGet(xhrArgs);
		req.addCallback(callback);
//		req.addErrback(onError);
	},
	_convertExhibit: function(data) {
		var auxP = [];
		var auxC = [];
		
		this._prepareExhibit(data);
		dojo.forEach(data.items, function(item) {
			if (item.type === "Property") {
				var source = {"id": item.id, "property": item.id, label: {"en": item.label}, description: {"en": item.description || item.comment}};
				if (!item.ranges || item.ranges["http://www.w3.org/2000/01/rdf-schema#Literal"]) {
					source["type"] = "text";
					source["nodetype"] = "LANGUAGE_LITERAL"
					auxP.push(source);
				} else {
					var props = this._getPropertiesForClasses(data, item.ranges);
					var propArr = [];
					for (var p in props) {
						if (props.hasOwnProperty(p)) {
							propArr.push({"id": p});
						}
					}
//					if (propArr.length > 0) {
						source["type"] = "group";
						source.automatic = true;
						source.content = propArr;
						auxP.push(source);
//					}
					
				}
			} else if (item.type === "Class") {
				var source = {
					"id": item.id, 
					label: {"en": item.label}, 
					description: {"en": item.description || item.comment}
				};
				var t = {};
				t[item.id] = true;
				var props = this._getPropertiesForClasses(data, t);
				var propArr = [];
				for (var p in props) {
					if (props.hasOwnProperty(p)) {
						propArr.push({"id": p});
					}
				}
				if (propArr.length > 0) {
					source["type"] = "group";
					source.content = propArr;
					source.automatic = true;
					auxC.push(source);
				}
			}
		}, this);
		this._itemStore._createItems(auxP);
		this._itemStore._createItems(auxC);
		return {
				properties: dojo.map(auxP, function(item) {return item["id"]}), 
				classes: dojo.map(auxC, function(item) {return item["id"]})
			};
	},
	_prepareExhibit: function(exhibit) {
		//Index property items.
		exhibit.domainProperties = {};
		exhibit.propertyIndex = {};
		exhibit.classIndex = {};

		dojo.forEach(exhibit.items, function(item) {
			switch (item.type) {
				case "Property":
					exhibit.propertyIndex[item.id] = item;
					break;
				case "Class":
					exhibit.classIndex[item.id] = item;
					break;
			}
		});
		//Index ranges and domains
		dojo.forEach(exhibit.items, function(item) {
			switch (item.type) {
				case "Property":
					//Domains
					if (item.domain) {
						var props= exhibit.domainProperties[item.domain] || {};
						props[item.id] = true;
						exhibit.domainProperties[item.domain] = props;
					}
					//Range
					var spo = item;
					do {
						if (spo.range) {
							if (item.ranges == null) {
								item.ranges = {};
							}
							item.ranges[spo.range] = true;
						}
						spo = exhibit.propertyIndex[spo.subPropertyOf];
					} while (spo);
					break;
					
			}
		});
	},
	_getPropertiesForClasses: function(exhibit, clss) {
		var props = {};
		for (var cls in clss) {
			if (clss.hasOwnProperty(cls)) {
				if (exhibit.classIndex[cls]) {
					this._getPropertiesForClassesRecursive(exhibit, exhibit.classIndex[cls], props, {});
				}
			}
		}
		return props;
	},
	_getPropertiesForClassesRecursive: function(exhibit, cls, props, parentClasses) {
		if (parentClasses[cls.id]) {
			return;
		}
		parentClasses[cls.id] = true;
		var props2 = exhibit.domainProperties[cls.id];
		for (var prop in props2) {
			props[prop] = true;
		}
		if (cls.subClassOf == null) {
			return;
		} else if (dojo.isArray(cls.subClassOf)) {
			dojo.forEach(cls.subClassOf, function(superCls) {
				if (exhibit.classIndex[superCls]) {
					this._getPropertiesForClassesRecursive(exhibit, exhibit.classIndex[superCls], props, parentClasses);
				}
			}, this);
		} else if (exhibit.classIndex[cls.subClassOf]) {
			this._getPropertiesForClassesRecursive(exhibit, exhibit.classIndex[cls.subClassOf], props, parentClasses);
		}
	}
    });
});
},
'rdforms/apps/RDFView':function(){
/*global define*/
define(["dojo/_base/declare", 
	"dojo/_base/lang",
    "dojo/topic",
	"dojo/json",
	"dijit/layout/_LayoutWidget",
	"dijit/_TemplatedMixin",
	"dijit/_WidgetsInTemplateMixin",
    "dijit/layout/TabContainer",
    "dijit/form/SimpleTextarea",
	"rdfjson/Graph",
    "rdfjson/formats/converters",
	"dojo/text!./RDFViewTemplate.html"
], function(declare, lang, topic, json, _LayoutWidget,  _TemplatedMixin, _WidgetsInTemplateMixin,
            TabContainer, SimpleTextarea, Graph, converters, template) {

    return declare([_LayoutWidget, _TemplatedMixin, _WidgetsInTemplateMixin], {
        //===================================================
        // Public attributes
        //===================================================
        graph: "",
        subView: "rdf/xml",

        //===================================================
        // Public methods
        //===================================================
        getGraph: function() {
            switch(this.subView) {
                case "rdf/xml":
                    return this.getRDFXML();
                case "rdf/json":
                    return this.getRDFJSON();
            }
        },
        setGraph: function(graph) {
            switch(this.subView) {
                case "rdf/xml":
                    this.setRDFXML(graph);
                case "rdf/json":
                    this.setRDFJSON(graph);
            }
        },

        //===================================================
        // Inherited attributes
        //===================================================
        templateString: template,

        //===================================================
        // Inherited methods
        //===================================================
        startup: function() {
            this.inherited("startup", arguments);
            topic.subscribe(this._tabContainer.id+"-selectChild", lang.hitch(this, this._selectChild));
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
        getRDFXML: function() {
            return converters.rdfxml2graph(this._rdfxml.get("value"))
        },
        setRDFXML: function(graph) {
            this._rdfxml.set("value", converters.rdfjson2rdfxml(graph));
        },
        getRDFJSON: function() {
            return new Graph(json.parse(this._rdfjson.get("value")));
        },
        setRDFJSON: function(graph) {
            this._rdfjson.set("value", json.stringify(graph.exportRDFJSON(), 0, 2));
        },

        _selectChild: function(child) {
            var graph = this.getGraph();
            if(child === this._rdfxmlTab) {
                this.subView = "rdf/xml";
            } else if(child === this._rdfjsonTab) {
                this.subView = "rdf/json";
            }
            this.setGraph(graph);
        }
    });
});
},
'rdfjson/formats/converters':function(){
/*global define,require*/
define([
    "exports",
    "./rdfjson/util",
    "../Graph",
    "./rdfxml/terms",
    "./rdfxml/Rdfparser"
], function (exports, util, Graph, terms, Rdfparser) {

    var nss = {
        ical: "http://www.w3.org/2002/12/cal/ical#",
        role: "http://purl.org/role/terms/",
        dcterms: "http://purl.org/dc/terms/",
        rdfs: "http://www.w3.org/2000/01/rdf-schema#",
        rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
        owl: "http://www.w3.org/2002/07/owl#",
        vs: "http://www.w3.org/2003/06/sw-vocab-status/ns#",
        foaf: "http://xmlns.com/foaf/0.1/",
        wot: "http://xmlns.com/wot/0.1/",
        dc: "http://purl.org/dc/elements/1.1/"
    };
    var nscounter = 0;
    var sp = "  ";
    var sp2 = "    ";

    if (typeof window !== 'undefined' && (typeof window.DOMParser !== 'undefined' || typeof ActiveXObject !== 'undefined')) { //In browser

        exports.xml2string = function (xml) {
            return xml.xml;
        };

        exports.string2xml = function (text) {
            var doc;
	    try {
		if (window.DOMParser) {
                    var parser = new DOMParser();
                    doc = parser.parseFromString(text,"text/xml");
		} else { // Internet Explorer
                    doc=new ActiveXObject("Microsoft.XMLDOM");
                    doc.async = "false";
                    doc.loadXML(text);
                }
            } catch(e) {
		doc = null;
	    }
	    if ( !doc || !doc.documentElement || doc.getElementsByTagName( "parsererror" ).length ) {
		throw "Could not parse text as xml";
 	    }

	    return doc;
        };
    } else { //Not in browser
        // Non-browser environment, requires the XMLSerializer and xmldom libraries.
        exports.xml2string = function (xml) {
            return (new XMLSerializer()).serializeToString(xml);
        };

	if (require.has && require.has("host-node")) {
	    //Dojos bridge to nodejs own require 
	    require(['dojo/node!xmldom'], function(xmldom) {
		var DOMParser = xmldom["DOMParser"];	    
		exports.string2xml = function (text) {		
		    return new DOMParser().parseFromString(text, 'text/xml');
		};
	    });
	} else {
	    //Requirejs bridge to nodejs own require
	    exports.string2xml = function (text) {
		var DOMParser = require('xmldom')["DOMParser"];
		return new DOMParser().parseFromString(text, 'text/xml');
	    };
	}	
    }

    /**
     *
     * Imports RDF/XML into a Graph
     *
     * @param {Node|String} xml this is the XML document or XML string from where the RDF will be parsed.
     * @param {rdfjson.Graph|null} graph Where all tripples will be added, if null a new graph will be created.
     * @returns {rdfjson.Graph} where all found tripples have been added.
     */
    exports.rdfxml2graph = function (xml, graph) {

        if (util.isString(xml)) {
            xml = exports.string2xml(xml);
        }
        /**
         * @type {rdfjson.Graph}
         */
        var g = graph || new Graph({});
        var RDFFormula = terms.RDFFormula;
        var store = new RDFFormula();
        store.add = function (s, p, o) {
            var subj, pred, obj = {};
            //Subject
            if (s instanceof terms.RDFBlankNode) {
                subj = s.toString();
                g.registerBNode(subj);
            } else {
                subj = s.uri;
            }

            //Predicate
            if (p instanceof terms.RDFBlankNode) {
                pred = p.toString();
                g.registerBNode(pred);
            } else {
                pred = p.uri;
            }

            //Object
            if (o instanceof terms.RDFLiteral) {
                obj.type = "literal";
                obj.value = o.value;
                if (o.lang) {
                    obj.lang = o.lang;
                }
                if (o.datatype) {
                    obj.datatype = o.datatype.uri;
                }
            } else if (o instanceof terms.RDFSymbol) {
                obj.type = "uri";
                obj.value = o.uri;
            } else if (o instanceof terms.RDFBlankNode) {
                obj.value = o.toString();
                g.registerBNode(obj.value);
                obj.type = "bnode";
            }
            g.create(subj, pred, obj, true);
        };
        var parser = new Rdfparser(store);
        parser.parse(xml, "", "");
        return g;
    };
    exports.rdfjson2rdfxml = function (graph) {
        graph = graph instanceof Graph ? graph : new Graph(graph);
        var nsUsed = [], s, p, nsp, o, props, objs, i, g = graph._graph || graph; //just in case a Graph is provided.
        var nsAdded = {};
        var nsify = function (prop) {
            for (var ns in nss) {
                if (nss.hasOwnProperty(ns) && prop.indexOf(nss[ns]) === 0) {
                    if (!nsAdded[ns]) {
                        nsUsed.push(ns);
                        nsAdded[ns] = true;
                    }
                    return ns + ":" + prop.substring(nss[ns].length);
                }
            }
            var slash = prop.lastIndexOf("/");
            var hash = prop.lastIndexOf("#");
            if (hash > slash) {
                slash = hash;
            }
            nscounter++;
            ns = "ns" + nscounter;
            nss[ns] = prop.substring(0, slash + 1);
            nsUsed.push(ns);
            nsAdded[ns] = true;
            return ns + ":" + prop.substring(slash + 1);
        };

        var strs = [];
        for (s in g) {
            if (g.hasOwnProperty(s)) {
                if (s.substr(0, 2) === "_:") {
                    strs.push(sp + '<rdf:Description rdf:nodeID="_' + s.substring(2) + '">\n');
                } else {
                    strs.push(sp + '<rdf:Description rdf:about="' + s + '">\n');
                }
                props = g[s];
                for (p in props) {
                    if (props.hasOwnProperty(p)) {
                        objs = props[p];
                        nsp = nsify(p);
                        for (i = 0; i < objs.length; i++) {
                            o = objs[i];
                            switch (o.type) {
                                case "literal":
                                    var v = o.value.replace("&", "&amp;").replace("<", "&lt;");
                                    if (o.lang != null) {
                                        strs.push(sp2 + '<' + nsp + ' xml:lang="' + o.lang + '">' + v + '</' + nsp + '>\n');
                                    } else if (o.datatype != null) {
                                        strs.push(sp2 + '<' + nsp + ' rdf:datatype="' + o.datatype + '">' + v + '</' + nsp + '>\n');
                                    } else {
                                        strs.push(sp2 + '<' + nsp + '>' + v + '</' + nsp + '>\n');
                                    }
                                    break;
                                case "uri":
                                    strs.push(sp2 + '<' + nsp + ' rdf:resource="' + o.value + '"/>\n');
                                    break;
                                case "bnode":
				    if (o.value.substr(0, 2) === "_:") {
					strs.push(sp2 + '<' + nsp + ' rdf:nodeID="_' + o.value.substring(2) + '"/>\n');
				    } else {
					strs.push(sp2 + '<' + nsp + ' rdf:nodeID="' + o.value + '"/>\n');
				    }
                                    break;
                            }
                        }
                    }
                }
                strs.push(sp + '</rdf:Description>\n');
            }
        }
        var initialStrs = ['<?xml version="1.0"?>\n<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"'];
        for (var j = 0; j < nsUsed.length; j++) {
            if (nsUsed[j] !== "rdf") {
                initialStrs.push('\n\txmlns:' + nsUsed[j] + '="' + nss[nsUsed[j]] + '"');
            }
        }
        initialStrs.push('>\n');
        strs.unshift(initialStrs.join(""));
        strs.push('</rdf:RDF>');
        return strs.join("");
    };

    /**
     * Detects RDF as a string in the RDF/XML, as an instance of Graph or as a object literal
     * corresponding to a RDF/JSON structure.
     * Limitation: Parse JSON strings into object literals if the JSON.parse is available in the environment.
     *
     * @param {string|object} rdf in RDF/XML, RDF/JSON or a object literal corresponding to already parsed RDF/JSON.
     * @returns {Object} a report with the attributes: graph, format and potentially an error.
     */
    exports.detect = function(rdf) {
        var report = {};
        if (typeof rdf === "string") {
            var taste = rdf.substr(0,100);
            if (taste.substr(0,100).toLowerCase().indexOf("<rdf:rdf") !== -1) {
                report.format = "rdf/xml";
                try {
                    report.graph = exports.rdfxml2graph(rdf);
                } catch (e) {
                    report.error = "Invalid rdf/xml";
                }
            } else if (rdf.substring(0,2) === "{\"") {
                report.format = "rdf/json";
                if (typeof JSON === "undefined" || typeof JSON.parse !== "function") {
                    throw "Cannot parse rdf/json since the standard JSON parser is not available.";
                }
                try {
                    var jsonrdf = JSON.parse(this.rdfjson);
                    report.graph = new Graph(jsonrdf);
                } catch(e) {
                    report.error = "Invalid json.";
                }
            } else {
                report.error = "No RDF detected.";
            }
        } else if (rdf instanceof Graph) {
            report.format = "rdf/json";
            report.graph = rdf;
        } else if (lang.isObject(rdf)) {
            report.format = "rdf/json";
            report.graph = new Graph(rdf);
        } else {
            report.error = "unknown format";
        }
        if (!report.error) {
            var r = report.graph.validate();
            if (!r.valid) {
                report.error = "RDF/JSON is not valid.";
            }
        }
        return report;
    };

    exports.namespaces = function() {
        return nss;
    };
    exports.addNamespace = function(ns, expanded) {
        nss[ns] = expanded;
    };
});

},
'rdfjson/formats/rdfxml/terms':function(){
define(["./uri"], function(URI) {

	// These are the classes corresponding to the RDF and N3 data models
	//
	// Designed to look like rdflib and cwm designs.
	//
	// Issues: Should the names start with RDF to make them
	//      unique as program-wide symbols?
	//
	// W3C open source licence 2005.
	//

	var RDFTracking = 0;
    // Are we requiring reasons for statements?

	//takes in an object and makes it an object if it's a literal
	var makeTerm = function(val) {
	    //  fyi("Making term from " + val)
	    if (typeof val == 'object') return val;
	    if (typeof val == 'string') return new RDFLiteral(val);
	    if (typeof val == 'undefined') return undefined;
	    alert("Can't make term from " + val + " of type " + typeof val); // @@ add numbers
	};



	//	Symbol

	var RDFEmpty = function () {
        return this;
    };

	RDFEmpty.prototype.termType = 'empty';

	RDFEmpty.prototype.toString = function () {
        return ""
    };

	RDFEmpty.prototype.toNT = function () {
        return ""
    };


    /**
     * @return {string}
     */
    var RDFSymbol_toNT = function (x) {
        return ("<" + x.uri + ">");
    };


	var toNT = function () {
        return RDFSymbol_toNT(this);
    };


	var RDFSymbol = function(uri) {
    	this.uri = uri;
	    return this;
	};
	
	RDFSymbol.prototype.termType = 'symbol';

	RDFSymbol.prototype.toString = toNT;

	RDFSymbol.prototype.toNT = toNT;


	//	Blank Node

	var RDFNextId = 0;  // Gobal genid
	var NTAnonymousNodePrefix = "_:n";

	var RDFBlankNode = function() {
    	this.id = RDFNextId++;
	    return this;
	};

	RDFBlankNode.prototype.termType = 'bnode';

	RDFBlankNode.prototype.toNT = function() {
    	return NTAnonymousNodePrefix + this.id;
	};
	RDFBlankNode.prototype.toString = RDFBlankNode.prototype.toNT;  

	//	Literal

	var RDFLiteral = function(value, /*String=*/ lang, /*String=*/datatype) {
    	this.value = value;
    	this.lang=lang;	  // string
    	this.datatype=datatype;  // term
	    return this;
	};

	RDFLiteral.prototype.termType = 'literal';

    RDFLiteral.prototype.toNT = function() {
    	var str = this.value;
	    if (typeof str != 'string') {
			throw Error("Value of RDF literal is not string: "+str);
	    }
    	str = str.replace(/\\/g, '\\\\');  // escape
	    str = str.replace(/"/g, '\\"');
    	str = '"' + str + '"';

	    if (this.datatype){
    		//alert(this.datatype.termType+"   "+typeof this.datatype)
			str = str + '^^' + this.datatype;//.toNT()
    	}
    	if (this.lang) {
			str = str + "@" + this.lang;
    	}
    	return str;
	};

    RDFLiteral.prototype.toString = function () {
        return this.value;
    };

	var RDFCollection = function() {
    	this.id = RDFNextId++;
    	this.elements = [];
	    this.closed = false;
	};

	RDFCollection.prototype.termType = 'collection';

	RDFCollection.prototype.toNT = function() {
    	return NTAnonymousNodePrefix + this.id;
	};
	RDFCollection.prototype.toString = RDFCollection.prototype.toNT;

	RDFCollection.prototype.append = function (el) {
    	this.elements.push(el);
	};

	RDFCollection.prototype.close = function () {
    	this.closed = true;
	};

	//	Statement
	//
	//  This is a triple with an optional reason.
	//
	//   The reason can point to provenece or inference
	//
    /**
     * @return {string}
     */
    var RDFStatement_toNT = function() {
    	return (this.subject.toNT() + " "
	    	+ this.predicate.toNT() + " "
	    	+  this.object.toNT() +" .");
	};

	var RDFStatement = function(subject, predicate, object, why) {
    	this.subject = makeTerm(subject);
    	this.predicate = makeTerm(predicate);
    	this.object = makeTerm(object);
	    if (typeof why !='undefined') {
			this.why = why;
    	} else if (RDFTracking) {
			console.log("WARNING: No reason on "+subject+" "+predicate+" "+object);
	    }
    	return this;
	};

	RDFStatement.prototype.toNT = RDFStatement_toNT;
	RDFStatement.prototype.toString = RDFStatement_toNT;
	

	//	Formula
	//
	//	Set of statements.

	var RDFFormula = function() {
    	this.statements = [];
    	this.constraints = [];
    	this.initBindings = [];
    	this.optional = [];
    	return this;
	};

	/*function RDFQueryFormula() {
		this.statements = []
		this.constraints = []
		this.initBindings = []
		this.optional = []
		return this
	}*/

    /**
     * @return {string}
     */
    var RDFFormula_toNT = function() {
	    return "{\n" + this.statements.join('\n') + "}";
	};

	//RDFQueryFormula.prototype = new RDFFormula()
	//RDFQueryFormula.termType = 'queryFormula'
	RDFFormula.prototype.termType = 'formula';
	RDFFormula.prototype.toNT = RDFFormula_toNT;
	RDFFormula.prototype.toString = RDFFormula_toNT;   

	RDFFormula.prototype.add = function(subj, pred, obj, why) {
	    this.statements.push(new RDFStatement(subj, pred, obj, why));
	};

	// Convenience methods on a formula allow the creation of new RDF terms:

	RDFFormula.prototype.sym = function(uri,name) {
    	if (name != null) {
			uri = this.namespaces[uri] + name;
	    }
    	return new RDFSymbol(uri);
	};

	RDFFormula.prototype.literal = function(val, lang, dt) {
	    return new RDFLiteral(val.toString(), lang, dt);
	};

	RDFFormula.prototype.bnode = function() {
    	return new RDFBlankNode();
	};

	RDFFormula.prototype.formula = function () {
        return new RDFFormula();
    };

	RDFFormula.prototype.collection = function () {
    	return new RDFCollection();
	};


	/*RDFFormula.prototype.queryFormula = function() {
		return new RDFQueryFormula()
	}*/

	var RDFVariableBase = "varid:"; // We deem variabe x to be the symbol varid:x 

	//An RDFVariable is a type of s/p/o that's not literal. All it holds is it's URI.
	//It has type 'variable', and a function toNT that turns it into NTriple form
	var RDFVariable = function(rel) {
    	this.uri = URI.join(rel, RDFVariableBase);
    	return this;
	};

	RDFVariable.prototype.termType = 'variable';
	RDFVariable.prototype.toNT = function() {
    	if (this.uri.slice(0, RDFVariableBase.length) == RDFVariableBase) {
			return '?'+ this.uri.slice(RDFVariableBase.length);
		} // @@ poor man's refTo
		return '?' + this.uri;
	};

	RDFVariable.prototype.toString = RDFVariable.prototype.toNT;
	RDFVariable.prototype.classOrder = 7;

	RDFFormula.prototype.variable = function(name) {
    	return new RDFVariable(name);
	};

	RDFVariable.prototype.hashString = RDFVariable.prototype.toNT;

	// Parse a single token
	//
	// The bnode bit should not be used on program-external values; designed
	// for internal work such as storing a bnode id in an HTML attribute.
	// Not coded for literals.

	RDFFormula.prototype.fromNT = function(str) {
	    var len = str.length;
    	var ch = str.slice(0, 1);
    	if (ch == '<') return this.sym(str.slice(1,len-1));
    	if (ch == '_') {
			var x = new RDFBlankNode();
			x.id = parseInt(str.slice(3));
			RDFNextId--;
			return x
    	}
	    alert("Can't yet convert from NT: '"+str+"', "+str[0]);
	};
	
	return {RDFSymbol: RDFSymbol,
			RDFFormula: RDFFormula,
			RDFBlankNode: RDFBlankNode,
			RDFLiteral: RDFLiteral}
});
},
'rdfjson/formats/rdfxml/uri':function(){
define([], function() {
	
	//  Implementing URI-specific functions
	//
	//	See RFC 2386
	//
	// This is or was   http://www.w3.org/2005/10/ajaw/uri.js
	// 2005 W3C open source licence
	//
	//
	//  Take a URI given in relative or absolute form and a base
	//  URI, and return an absolute URI
	//
	//  See also http://www.w3.org/2000/10/swap/uripath.py
	//

	return {
		join: function (given, base) {
			// if (typeof fyi != 'undefined') fyi("   URI given="+given+" base="+base)
			var baseHash = base.indexOf('#');
	    	if (baseHash > 0) base = base.slice(0, baseHash);
	    	if (given.length==0) return base; // before chopping its filename off
	    	if (given.indexOf('#')==0) return base + given;
	    	var colon = given.indexOf(':');
	    	if (colon >= 0) return given;	// Absolute URI form overrides base URI
	    	var baseColon = base.indexOf(':');
	    	if (baseColon<0) {
	    		console.log("Invalid base URL "+ base);
	    		return given;
	    	}
	    	var baseScheme = base.slice(0,baseColon+1);  // eg http:
	    	if (given.indexOf("//") == 0) {    // Starts with //
				return baseScheme + given;
			}
            var baseSingle;
	    	if (base.indexOf('//', baseColon)==baseColon+1) {  // Any hostpart?
		    	baseSingle = base.indexOf("/", baseColon+3);
				if (baseSingle < 0) {
		    		if (base.length-baseColon-3 > 0) {
						return base + "/" + given;
		    		} else {
						return baseScheme + given;
		    		}
				}
	    	} else {
				baseSingle = base.indexOf("/", baseColon+1);
				if (baseSingle < 0) {
		    		if (base.length-baseColon-1 > 0) {
						return base + "/" + given;
		    		} else {
						return baseScheme + given;
		    		}
				}
	    	}
		    if (given.indexOf('/') == 0) {	// starts with / but not //
				return base.slice(0, baseSingle) + given;
			}
	
		    var path = base.slice(baseSingle);
			var lastSlash = path.lastIndexOf('/');
			if (lastSlash <0) return baseScheme + given;
			if ((lastSlash >=0) && (lastSlash < (path.length-1))) {
				path = path.slice(0, lastSlash+1); // Chop trailing filename from base
			}
	
		    path = path + given;
			while (path.match(/[^\/]*\/\.\.\//)) {// must apply to result of prev
				path = path.replace( /[^\/]*\/\.\.\//, ''); // ECMAscript spec 7.8.5
			}
			path = path.replace( /\.\//g, ''); // spec vague on escaping
			return base.slice(0, baseSingle) + path;
		},
		/** returns URI without the frag **/
		docpart: function (uri) {
			var i = uri.indexOf("#");
			if (i < 0) return uri;
			return uri.slice(0,i);
		},
		/** return the protocol of a uri **/
		protocol: function (uri) {
			return uri.slice(0, uri.indexOf(':'));
		}
	};
});
/*URIjoin = Util.uri.join
uri_docpart = Util.uri.docpart
uri_protocol = Util.uri.protocol*/
},
'rdfjson/formats/rdfxml/Rdfparser':function(){
define(["./uri"], function(URI) {

/**
 * @fileoverview
 * TABULATOR RDF PARSER
 *
 * Version 0.1
 *  Parser believed to be in full positive RDF/XML parsing compliance
 *  with the possible exception of handling deprecated RDF attributes
 *  appropriately. Parser is believed to comply fully with other W3C
 *  and industry standards where appropriate (DOM, ECMAScript, &c.)
 *
 *  Author: David Sheets <dsheets@mit.edu>
 *  SVN ID: $Id$
 *
 * W3C® SOFTWARE NOTICE AND LICENSE
 * http://www.w3.org/Consortium/Legal/2002/copyright-software-20021231
 * This work (and included software, documentation such as READMEs, or
 * other related items) is being provided by the copyright holders under
 * the following license. By obtaining, using and/or copying this work,
 * you (the licensee) agree that you have read, understood, and will
 * comply with the following terms and conditions.
 * 
 * Permission to copy, modify, and distribute this software and its
 * documentation, with or without modification, for any purpose and
 * without fee or royalty is hereby granted, provided that you include
 * the following on ALL copies of the software and documentation or
 * portions thereof, including modifications:
 * 
 * 1. The full text of this NOTICE in a location viewable to users of
 * the redistributed or derivative work.
 * 2. Any pre-existing intellectual property disclaimers, notices, or terms and
 * conditions. If none exist, the W3C Software Short Notice should be
 * included (hypertext is preferred, text is permitted) within the body
 * of any redistributed or derivative code.
 * 3. Notice of any changes or modifications to the files, including the
 * date changes were made. (We recommend you provide URIs to the location
 * from which the code is derived.)
 * 
 * THIS SOFTWARE AND DOCUMENTATION IS PROVIDED "AS IS," AND COPYRIGHT
 * HOLDERS MAKE NO REPRESENTATIONS OR WARRANTIES, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO, WARRANTIES OF MERCHANTABILITY OR FITNESS
 * FOR ANY PARTICULAR PURPOSE OR THAT THE USE OF THE SOFTWARE OR
 * DOCUMENTATION WILL NOT INFRINGE ANY THIRD PARTY PATENTS, COPYRIGHTS,
 * TRADEMARKS OR OTHER RIGHTS.
 * 
 * COPYRIGHT HOLDERS WILL NOT BE LIABLE FOR ANY DIRECT, INDIRECT, SPECIAL
 * OR CONSEQUENTIAL DAMAGES ARISING OUT OF ANY USE OF THE SOFTWARE OR
 * DOCUMENTATION.
 * 
 * The name and trademarks of copyright holders may NOT be used in
 * advertising or publicity pertaining to the software without specific,
 * written prior permission. Title to copyright in this software and any
 * associated documentation will at all times remain with copyright
 * holders.
 */
    /**
     * @class Class defining an RDFParser resource object tied to an RDFStore
     *
     * @author David Sheets <dsheets@mit.edu>
     * @version 0.1
     *
     * @constructor
     * @param store An RDFStore object
     */
    var RDFParser;
    RDFParser = function (store) {
        /** Standard namespaces that we know how to handle @final
         *  @member RDFParser
         */
        RDFParser['ns'] = {'RDF': "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
            'RDFS': "http://www.w3.org/2000/01/rdf-schema#"};
        /** DOM Level 2 node type magic numbers @final
         *  @member RDFParser
         */
        RDFParser['nodeType'] = {'ELEMENT': 1, 'ATTRIBUTE': 2, 'TEXT': 3,
            'CDATA_SECTION': 4, 'ENTITY_REFERENCE': 5,
            'ENTITY': 6, 'PROCESSING_INSTRUCTION': 7,
            'COMMENT': 8, 'DOCUMENT': 9, 'DOCUMENT_TYPE': 10,
            'DOCUMENT_FRAGMENT': 11, 'NOTATION': 12};

        /**
         * Frame class for namespace and base URI lookups
         * Base lookups will always resolve because the parser knows
         * the default base.
         *
         * @private
         */
        this['frameFactory'] = function (parser, parent, element) {
            return {'NODE': 1,
                'ARC': 2,
                'parent': parent,
                'parser': parser,
                'store': parser['store'],
                'element': element,
                'lastChild': 0,
                'base': null,
                'lang': null,
                'node': null,
                'nodeType': null,
                'listIndex': 1,
                'rdfid': null,
                'datatype': null,
                'collection': false,

                /** Terminate the frame and notify the store that we're done */
                'terminateFrame': function () {
                    if (this['collection']) {
                        this['node']['close']()
                    }
                },

                /** Add a symbol of a certain type to the this frame */
                'addSymbol': function (type, uri) {
                    uri = URI.join(uri, this['base']);
                    this['node'] = this['store']['sym'](uri);
                    this['nodeType'] = type
                },

                /** Load any constructed triples into the store */
                'loadTriple': function () {
                    if (this['parent']['parent']['collection']) {
                        this['parent']['parent']['node']['append'](this['node'])
                    }
                    else {
                        this['store']['add'](this['parent']['parent']['node'],
                            this['parent']['node'],
                            this['node'],
                            this['parser']['why'])
                    }
                    if (this['parent']['rdfid'] != null) { // reify
                        var triple = this['store']['sym'](
                            URI.join("#" + this['parent']['rdfid'],
                                this['base']));
                        this['store']['add'](triple,
                            this['store']['sym'](
                                RDFParser['ns']['RDF']
                                    + "type"),
                            this['store']['sym'](
                                RDFParser['ns']['RDF']
                                    + "Statement"),
                            this['parser']['why']);
                        this['store']['add'](triple,
                            this['store']['sym'](
                                RDFParser['ns']['RDF']
                                    + "subject"),
                            this['parent']['parent']['node'],
                            this['parser']['why']);
                        this['store']['add'](triple,
                            this['store']['sym'](
                                RDFParser['ns']['RDF']
                                    + "predicate"),
                            this['parent']['node'],
                            this['parser']['why']);
                        this['store']['add'](triple,
                            this['store']['sym'](
                                RDFParser['ns']['RDF']
                                    + "object"),
                            this['node'],
                            this['parser']['why'])
                    }
                },

                /** Check if it's OK to load a triple */
                'isTripleToLoad': function () {
                    return (this['parent'] != null
                        && this['parent']['parent'] != null
                        && this['nodeType'] == this['NODE']
                        && this['parent']['nodeType'] == this['ARC']
                        && this['parent']['parent']['nodeType']
                        == this['NODE'])
                },

                /** Add a symbolic node to this frame */
                'addNode': function (uri) {
                    this['addSymbol'](this['NODE'], uri);
                    if (this['isTripleToLoad']()) {
                        this['loadTriple']()
                    }
                },

                /** Add a collection node to this frame */
                'addCollection': function () {
                    this['nodeType'] = this['NODE'];
                    this['node'] = this['store']['collection']();
                    this['collection'] = true;
                    if (this['isTripleToLoad']()) {
                        this['loadTriple']()
                    }
                },

                /** Add a collection arc to this frame */
                'addCollectionArc': function () {
                    this['nodeType'] = this['ARC']
                },

                /** Add a bnode to this frame */
                'addBNode': function (id) {
                    if (id != null) {
                        if (this['parser']['bnodes'][id] != null) {
                            this['node'] = this['parser']['bnodes'][id]
                        } else {
                            this['node'] = this['parser']['bnodes'][id] = this['store']['bnode']()
                        }
                    } else {
                        this['node'] = this['store']['bnode']()
                    }

                    this['nodeType'] = this['NODE'];
                    if (this['isTripleToLoad']()) {
                        this['loadTriple']()
                    }
                },

                /** Add an arc or property to this frame */
                'addArc': function (uri) {
                    if (uri == RDFParser['ns']['RDF'] + "li") {
                        uri = RDFParser['ns']['RDF'] + "_" + this['parent']['listIndex']++
                    }
                    this['addSymbol'](this['ARC'], uri)
                },

                /** Add a literal to this frame */
                'addLiteral': function (value) {
                    if (this['parent']['datatype']) {
                        this['node'] = this['store']['literal'](
                            value, "", this['store']['sym'](
                                this['parent']['datatype']))
                    }
                    else {
                        this['node'] = this['store']['literal'](
                            value, this['lang'])
                    }
                    this['nodeType'] = this['NODE'];
                    if (this['isTripleToLoad']()) {
                        this['loadTriple']()
                    }
                }
            }
        };

        /** Our triple store reference @private */
        this['store'] = store;
        /** Our identified blank nodes @private */
        this['bnodes'] = {};
        /** A context for context-aware stores @private */
        this['why'] = null;
        /** Reification flag */
        this['reify'] = false;

        /**
         * Build our initial scope frame and parse the DOM into triples
         * @param document The DOM to parse
         * @param {String} base The base URL to use
         * @param {Object} why The context to which this resource belongs
         */
        this['parse'] = function (document, base, why) {
            var children = document['childNodes'], root;

            // clean up for the next run
            this['cleanParser']();

            // figure out the root element
            if (document['nodeType'] == RDFParser['nodeType']['DOCUMENT']) {
                for (var c = 0; c < children['length']; c++) {
                    if (children[c]['nodeType']
                        == RDFParser['nodeType']['ELEMENT']) {
                        root = children[c];
                        break
                    }
                }
            }
            else if (document['nodeType'] == RDFParser['nodeType']['ELEMENT']) {
                root = document
            }
            else {
                throw new Error("RDFParser: can't find root in " + base
                    + ". Halting. ");
            }

            this['why'] = why;

            // our topmost frame

            var f = this['frameFactory'](this);
            f['base'] = base;
            f['lang'] = '';

            this['parseDOM'](this['buildFrame'](f, root));
            return true
        };
        this['parseDOM'] = function (frame) {
            // a DOM utility function used in parsing
            var elementURI = function (el) {
                return el['namespaceURI'] + el['localName']
            };
            var dig = true; // if we'll dig down in the tree on the next iter

            while (frame['parent']) {
                var rdfid, bnid;
                var dom = frame['element'];
                var attrs = dom['attributes'];

                if (dom['nodeType']
                    == RDFParser['nodeType']['TEXT']
                    || dom['nodeType']
                    == RDFParser['nodeType']['CDATA_SECTION']) {//we have a literal
                    frame['addLiteral'](dom['nodeValue'])
                }
                else if (elementURI(dom)
                    != RDFParser['ns']['RDF'] + "RDF") { // not root
                    if (frame['parent'] && frame['parent']['collection']) {
                        // we're a collection element
                        frame['addCollectionArc']();
                        frame = this['buildFrame'](frame, frame['element']);
                        frame['parent']['element'] = null
                    }
                    if (!frame['parent'] || !frame['parent']['nodeType']
                        || frame['parent']['nodeType'] == frame['ARC']) {
                        // we need a node
                        var about = dom['getAttributeNodeNS'](
                            RDFParser['ns']['RDF'], "about");
                        rdfid = dom['getAttributeNodeNS'](
                            RDFParser['ns']['RDF'], "ID");
                        if (about && rdfid) {
                            throw new Error("RDFParser: " + dom['nodeName']
                                + " has both rdf:id and rdf:about."
                                + " Halting. Only one of these"
                                + " properties may be specified on a"
                                + " node.");
                        }
                        if (about == null && rdfid) {
                            frame['addNode']("#" + rdfid['nodeValue']);
                            dom['removeAttributeNode'](rdfid)
                        }
                        else if (about == null && rdfid == null) {
                            bnid = dom['getAttributeNodeNS'](
                                RDFParser['ns']['RDF'], "nodeID");
                            if (bnid) {
                                frame['addBNode'](bnid['nodeValue']);
                                dom['removeAttributeNode'](bnid)
                            } else {
                                frame['addBNode']()
                            }
                        }
                        else {
                            frame['addNode'](about['nodeValue']);
                            dom['removeAttributeNode'](about)
                        }

                        // Typed nodes
                        var rdftype = dom['getAttributeNodeNS'](
                            RDFParser['ns']['RDF'], "type");
                        if (RDFParser['ns']['RDF'] + "Description"
                            != elementURI(dom)) {
                            rdftype = {'nodeValue': elementURI(dom)}
                        }
                        if (rdftype != null) {
                            this['store']['add'](frame['node'],
                                this['store']['sym'](
                                    RDFParser['ns']['RDF'] + "type"),
                                this['store']['sym'](
                                    URI.join(
                                        rdftype['nodeValue'],
                                        frame['base'])),
                                this['why']);
                            if (rdftype['nodeName']) {
                                dom['removeAttributeNode'](rdftype)
                            }
                        }

                        // Property Attributes
                        for (var x = attrs['length'] - 1; x >= 0; x--) {
                            this['store']['add'](frame['node'],
                                this['store']['sym'](
                                    elementURI(attrs[x])),
                                this['store']['literal'](
                                    attrs[x]['nodeValue'],
                                    frame['lang']),
                                this['why'])
                        }
                    }
                    else { // we should add an arc (or implicit bnode+arc)
                        frame['addArc'](elementURI(dom));

                        // save the arc's rdf:ID if it has one
                        if (this['reify']) {
                            rdfid = dom['getAttributeNodeNS'](
                                RDFParser['ns']['RDF'], "ID");
                            if (rdfid) {
                                frame['rdfid'] = rdfid['nodeValue'];
                                dom['removeAttributeNode'](rdfid)
                            }
                        }

                        var parsetype = dom['getAttributeNodeNS'](
                            RDFParser['ns']['RDF'], "parseType");
                        var datatype = dom['getAttributeNodeNS'](
                            RDFParser['ns']['RDF'], "datatype");
                        if (datatype) {
                            frame['datatype'] = datatype['nodeValue'];
                            dom['removeAttributeNode'](datatype)
                        }

                        if (parsetype) {
                            var nv = parsetype['nodeValue'];
                            if (nv == "Literal") {
                                frame['datatype']
                                    = RDFParser['ns']['RDF'] + "XMLLiteral";
                                // (this.buildFrame(frame)).addLiteral(dom)
                                // should work but doesn't
                                frame = this['buildFrame'](frame);
                                frame['addLiteral'](dom);
                                dig = false
                            }
                            else if (nv == "Resource") {
                                frame = this['buildFrame'](frame, frame['element']);
                                frame['parent']['element'] = null;
                                frame['addBNode']()
                            }
                            else if (nv == "Collection") {
                                frame = this['buildFrame'](frame, frame['element']);
                                frame['parent']['element'] = null;
                                frame['addCollection']()
                            }
                            dom['removeAttributeNode'](parsetype)
                        }

                        if (attrs['length'] != 0) {
                            var resource = dom['getAttributeNodeNS'](
                                RDFParser['ns']['RDF'], "resource");
                            bnid = dom['getAttributeNodeNS'](
                                RDFParser['ns']['RDF'], "nodeID");

                            frame = this['buildFrame'](frame);
                            if (resource) {
                                frame['addNode'](resource['nodeValue']);
                                dom['removeAttributeNode'](resource)
                            } else {
                                if (bnid) {
                                    frame['addBNode'](bnid['nodeValue']);
                                    dom['removeAttributeNode'](bnid)
                                } else {
                                    frame['addBNode']()
                                }
                            }

                            for (x = attrs['length'] - 1; x >= 0; x--) {
                                var f = this['buildFrame'](frame);
                                f['addArc'](elementURI(attrs[x]));
                                if (elementURI(attrs[x])
                                    == RDFParser['ns']['RDF'] + "type") {
                                    (this['buildFrame'](f))['addNode'](
                                        attrs[x]['nodeValue'])
                                } else {
                                    (this['buildFrame'](f))['addLiteral'](
                                        attrs[x]['nodeValue'])
                                }
                            }
                        }
                        else if (dom['childNodes']['length'] == 0) {
                            (this['buildFrame'](frame))['addLiteral']("")
                        }
                    }
                } // rdf:RDF

                // dig dug
                dom = frame['element'];
                while (frame['parent']) {
                    var pframe = frame;
                    while (dom == null) {
                        frame = frame['parent'];
                        dom = frame['element']
                    }
                    var ch = dom['childNodes'];
                    var candidate = ch != null ? ch[frame['lastChild']] : null;
                    if (candidate == null || !dig) {
                        frame['terminateFrame']();
                        if (!(frame = frame['parent'])) {
                            break
                        } // done
                        dom = frame['element'];
                        dig = true
                    }
                    else if ((candidate['nodeType']
                        != RDFParser['nodeType']['ELEMENT']
                        && candidate['nodeType']
                        != RDFParser['nodeType']['TEXT']
                        && candidate['nodeType']
                        != RDFParser['nodeType']['CDATA_SECTION'])
                        || ((candidate['nodeType']
                        == RDFParser['nodeType']['TEXT']
                        || candidate['nodeType']
                        == RDFParser['nodeType']['CDATA_SECTION'])
                        && dom['childNodes']['length'] != 1)) {
                        frame['lastChild']++
                    }
                    else { // not a leaf
                        frame['lastChild']++;
                        frame = this['buildFrame'](pframe,
                            dom['childNodes'][frame['lastChild'] - 1]);
                        break
                    }
                }
            } // while
        };

        /**
         * Cleans out state from a previous parse run
         * @private
         */
        this['cleanParser'] = function () {
            this['bnodes'] = {};
            this['why'] = null
        };

        /**
         * Builds scope frame
         * @private
         */
        this['buildFrame'] = function (parent, element) {
            var frame = this['frameFactory'](this, parent, element);
            if (parent) {
                frame['base'] = parent['base'];
                frame['lang'] = parent['lang']
            }
            if (element == null
                || element['nodeType'] == RDFParser['nodeType']['TEXT']
                || element['nodeType'] == RDFParser['nodeType']['CDATA_SECTION']) {
                return frame
            }

            var attrs = element['attributes'];

            var base = element['getAttributeNode']("xml:base");
            if (base != null) {
                frame['base'] = base['nodeValue'];
                element['removeAttribute']("xml:base")
            }
            var lang = element['getAttributeNode']("xml:lang");
            if (lang != null) {
                frame['lang'] = lang['nodeValue'];
                element['removeAttribute']("xml:lang")
            }

            // remove all extraneous xml and xmlns attributes
            for (var x = attrs['length'] - 1; x >= 0; x--) {
                if (attrs[x]['nodeName']['substr'](0, 3) == "xml") {
                    element['removeAttributeNode'](attrs[x])
                }
            }
            return frame
        }
    };
return RDFParser;
});
},
'rdforms/apps/Validator':function(){
/*global define*/
define(["dojo/_base/declare", 
	"dojo/_base/lang", 
	"dojo/_base/array",
	"dojo/window",
	"dojo/json",
	"dojo/dom-class", 
	"dojo/dom-construct", 
	"dojo/dom-attr",
	"dojo/dom-style",
	"dijit/_WidgetBase",
	"dijit/_TemplatedMixin",
	"dijit/_WidgetsInTemplateMixin",
    "dijit/TitlePane",
    "dijit/form/SimpleTextarea",
    "dijit/form/Button",
	"dijit/Dialog",
	"rdfjson/Graph",
	"../model/Engine",
	"../template/ItemStore",
	"../view/ValidationPresenter",
	"dojo/text!./ValidatorTemplate.html"
], function(declare, lang, array, window, json, domClass, construct, attr, style, _WidgetBase,
            _TemplatedMixin, _WidgetsInTemplateMixin, TitlePane, SimpleTextarea, Button, Dialog, Graph,
            Engine, ItemStore, ValidationPresenter, template) {

    return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
	//===================================================
	// Public attributes
	//===================================================
	itemStore: null,
	type2template: null,
	rdfjson: null,
	rdfjsonEditorOpen: false,
	
	//===================================================
	// Inherited attributes
	//===================================================
	templateString: template,
	
	//===================================================
	// Inherited methods
	//===================================================
	postCreate: function() {
	    this.inherited("postCreate", arguments);
	    this.itemStore = this.itemStore || new ItemStore();
	    if (typeof this.rdfjson === "string") {
		this._rdfjsonDijit.set("value", this.rdfjson);			
	    } else {
		this._rdfjsonDijit.set("value", json.stringify(this.rdfjson, true, "  "));			
	    }
	    this._update();
	},
	//===================================================
	// Private methods
	//===================================================
	_update: function() {
	    this._validateJSON();
	    this._validateRDFJSON();
	    this._validateRForms();		
	},
	_validateJSON: function() {
	    delete this._rdfjsonObj;
	    try {
		this._rdfjsonObj = json.parse(this._rdfjsonDijit.get("value"));
		domClass.toggle(this._jsonNode, "error", false);
		attr.set(this._jsonNode, "innerHTML", "RDF input: Valid JSON");
	    } catch (e) {
		domClass.toggle(this._jsonNode, "error", true);
		attr.set(this._jsonNode, "innerHTML", "RDF input: Invalid JSON: "+e);
	    }
	},
	_validateRDFJSON: function() {
	    delete this._graph;
	    attr.set(this._rdfjsonNode, "innerHTML", "");
	    domClass.toggle(this._rdfjsonNode, "error", false);
	    if (this._rdfjsonObj == null) {
		return;
	    }
	    try {
		this._graph = new Graph(this._rdfjsonObj, false);
		this._graph.validate();
		construct.create("div", {"innerHTML": "RDF input: Valid RDF/JSON, "+this._graph.report.nr+" statements found."}, this._rdfjsonNode);
		//checkInstances(graph, "http://xmlns.com/foaf/0.1/Document", ttemplate);
	    } catch (e) {
		domClass.toggle(this._rdfjsonNode, "error", true);
		construct.create("div", {"innerHTML": "RDF input: Invalid RDF/JSON, although "+e.nr+" valid statements found."}, this._rdfjsonNode);
		this._explainInvalidRDFJSON(e);
	    }
	},
	_explainInvalidRDFJSON: function(report) {
	    var table = construct.create("table", {"class": "report"}, this._rdfjsonNode);
	    var head = construct.create("tr", null, table);
	    construct.create("th", {innerHTML: "Subject"}, head);
	    construct.create("th", {innerHTML: "Predicate"}, head);
	    construct.create("th", {innerHTML: "ObjectNr"}, head);
	    construct.create("th", {innerHTML: "Error"}, head);
	    array.forEach(report.errors, function(err) {
		var row = construct.create("tr", null, table);
		construct.create("td", {innerHTML: err.s}, row);
		construct.create("td", {innerHTML: err.p || ""}, row);
		construct.create("td", {innerHTML: ""+ (err.oindex || "")}, row);
		construct.create("td", {innerHTML: err.message}, row);
	    });		
	},
	_validateRForms: function() {
	    attr.set(this._rformsNode, "innerHTML", "");
	    domClass.toggle(this._rformsNode, "error", false);
	    if (this._graph == null) {
		return;
	    }
	    for (var key in this.type2template) {
		if (this.type2template.hasOwnProperty(key)) {
		    this._checkInstances(key, this.type2template[key]);
		}
	    }
	},
	_checkInstances: function(type, templateId) {
	    var template = this.itemStore.getTemplate(templateId);
	    var instances = this._graph.find(null, "http://www.w3.org/TR/rdf-schema/type", type);
	    if (instances.length > 0) {
		construct.create("div", {"class": "instanceType", innerHTML: type}, this._rformsNode);			
	    }
	    array.forEach(instances, function(instance) {
		var iNode = construct.create("div", {"class": "instance"}, this._rformsNode);
		var binding = Engine.match(this._graph, instance.getSubject(), template);
		var report = binding.report();
		if (report.errors.length > 0 || report.warnings.length > 0) {
		    if (report.errors.length > 0) {
			domClass.add(iNode, "error");
		    } else {
			domClass.add(iNode, "warning");
		    }
		    construct.create("div", {"class": "instanceHeading", "innerHTML": "<span class='action info'></span>&nbsp;<b>"+instance.getSubject()+"</b> is not ok:",
					     onclick: lang.hitch(this, this._openView, binding, template)}, iNode);
		    var table = construct.create("table", {"class": "report"}, iNode);
		    var head = construct.create("tr", null, table);
		    construct.create("th", {innerHTML: "Severity"}, head);
		    construct.create("th", {innerHTML: "Subject"}, head);
		    construct.create("th", {innerHTML: "Predicate"}, head);
		    construct.create("th", {innerHTML: "Problem"}, head);
		    array.forEach(report.errors, function(err) {
			var row = construct.create("tr", {"class": "error"}, table);
			construct.create("td", {innerHTML: "Error"}, row);
			construct.create("td", {innerHTML: err.parentBinding.getChildrenRootUri()}, row);
			construct.create("td", {innerHTML: err.item.getProperty()}, row);
			construct.create("td", {innerHTML: err.message}, row);
		    });
		    array.forEach(report.warnings, function(warn) {
			var row = construct.create("tr", {"class": "warning"}, table);
			construct.create("td", {innerHTML: "Warning"}, row);
			construct.create("td", {innerHTML: warn.parentBinding.getChildrenRootUri()}, row);
			construct.create("td", {innerHTML: warn.item.getProperty()}, row);
			construct.create("td", {innerHTML: warn.message}, row);
		    });							
		} else {
		    construct.create("div", {"class": "instanceHeading", "innerHTML": "<span class='action info'></span>&nbsp;<b>"+instance.getSubject()+"</b> is ok ", 
					     onclick: lang.hitch(this, this._openView, binding, template)}, iNode);
		}
	    }, this);
	},
	_openView: function(binding, template) {
	    var node = construct.create("div");
	    var dialog = new Dialog({"content": node});
	    var presenter = new ValidationPresenter({template: template, binding: binding, includeLevel: "recommended", compact: true}, node);
	    var viewport = window.getBox();
	    style.set(presenter.domNode, {
		width: Math.floor(viewport.w * 0.70)+"px",
                height: Math.floor(viewport.h * 0.70)+"px",
                overflow: "auto",
                position: "relative"    // workaround IE bug moving scrollbar or dragging dialog
	    });
	    dialog.show();
	}
    });
});
},
'rdforms/view/ValidationPresenter':function(){
/*global define*/
define([
    "dojo/_base/declare",
    "dojo/dom-class",
    "dojo/dom-construct",
    "../template/Group",
    "../template/PropertyGroup",
    "../model/Engine",
    "./Presenter"
], function(declare, domClass, construct, Group, PropertyGroup, Engine, Presenter) {

    var ValidationPresenter = declare(Presenter, {
	//===================================================
	// Public attributes
	//===================================================
	showLanguage: true,
	filterTranslations: false,
	styleCls: "rformsPresenter",
	
	//===================================================
	// Public API
	//===================================================
	showNow: function(item, bindings) {
		if (item.hasStyle("invisible")) {
			return false;
		}
		if (bindings.length > 0) {
			return true;
		}
		var card = item.getCardinality();
		switch(this.includeLevel) {
			case "mandatory":
				return card && card.min>=1;
			case "recommended":
				return card && (card.min>=1 || card.pref>=1);
			default:
				return true;
		}
	},
	
	showAsTable: function() {
		return false;
	},
	
	/**
	 * Has no effect on items that with node type different than LANGUAGE_LITERAL or if filterTranslations is set to false. 
	 * Otherwise a single binding is returned with the best language match according to the locale.
	 * 
	 * @param {Object} item
	 * @param {Object} bindings
	 * @param {Array} with a single value if the filtering has taken place, otherwise same as input bindings.
	 */
	prepareBindings: function(item, bindings) {
		var card = item.getCardinality();
		var target, min = card.min != null ? card.min : 0, pref = card.pref != null ? card.pref : 0;
		if (card.pref > 0) {
			target = card.pref;
		} else if (card.min > 0) {
			target = card.min;
		} else if (item instanceof PropertyGroup) {
			target = 0;
		} else if (item instanceof Group) {
			if (item.getProperty() == null) {
				target = 1;
			} else {
				target = 0;
			}
		} else {
			target = 1;
		}
		if (target > bindings.length) {
			bindings = bindings.concat([]);
			while(target > bindings.length) {
				var binding = Engine.create(this.binding, item);
				if (bindings.length < min) {
					binding.error = true;
				} else if (bindings.length < pref){
					binding.warning = true;
				}
				bindings.push(binding);
			}
		}
		return bindings;
	},
	
	skipBinding: function(binding) {
		return false;
	},
	
	addValidationMarker: function(fieldDiv, binding) {
		var card = binding.getItem().getCardinality();
		var min = card.min != null ? card.min : 0, pref = card.pref != null ? card.pref : 0;
		if (binding.error) {
			domClass.add(fieldDiv, "error");
			construct.create("div", {"innerHTML": ""+min+" value"+(min === 1? "": "s")+" is required"}, fieldDiv);
			return true;
		} else if (binding.warning){
			domClass.add(fieldDiv, "warning");
			construct.create("div", {"innerHTML": ""+pref+" value"+(pref === 1? "": "s")+" is recommended."}, fieldDiv);
			return true;
		} else {
			return false;
		}
	},
	
	addGroup: function(fieldDiv, binding) {
		if (!this.addValidationMarker(fieldDiv, binding)) {
			new ValidationPresenter({binding: binding, topLevel: false}, fieldDiv);
		}
	},

	addText: function(fieldDiv, binding) {
		if (!this.addValidationMarker(fieldDiv, binding)) {
			this.inherited("addText", arguments);
		}
	},
	addChoice: function(fieldDiv, binding) {
		if (!this.addValidationMarker(fieldDiv, binding)) {
			this.inherited("addChoice", arguments);
		}
	}
    });
    return ValidationPresenter;
});
},
'rdforms/apps/LDBrowser':function(){
/*global define*/
define(["dojo/_base/declare", 
	"dojo/_base/lang",
	"dojo/_base/array",
	'dojo/on',
	'dojo/promise/all',
	"dojo/Deferred",
	"dojo/request",
	"dojo/dom-style",
	"dojo/dom-construct",
	"dojo/dom-attr",
	"dijit/layout/_LayoutWidget",
	"dijit/_TemplatedMixin",
	"dijit/_WidgetsInTemplateMixin",
	"dijit/layout/TabContainer",
	"dijit/layout/ContentPane",
	"dijit/layout/BorderContainer",
	"dijit/form/TextBox",
	"dijit/Dialog",
	"dijit/ProgressBar",
	"rdforms/model/Engine",
	"rdforms/view/Presenter",
	"rdforms/apps/RDFView",
	'rdforms/model/system',
	'rdforms/template/ItemStore',
	"rdfjson/Graph",
	"rdfjson/formats/converters",
	'dojo/hash',
	'dojo/topic',
	'dojo/keys',
	'dojo/io-query',
	"dojo/text!./LDBrowserTemplate.html"
], function(declare, lang, array, on, all, Deferred, request, domStyle, domConstruct, domAttr, _LayoutWidget,  _TemplatedMixin,
            _WidgetsInTemplateMixin, TabContainer, ContentPane, BorderContainer, TextBox, Dialog, ProgressBar, Engine, Presenter,
            RDFView, system, ItemStore, Graph, converters, hash, topic, keys, ioQuery, template) {

    /**
     * Linked Data browser, initialize by:
     * var is = new ItemStore();
     * is.registerBundle(...);
     * var ldp = new LDBrowser({
     *      itemstore: is,
     *      initialURI: "http://example.com/a",
     *      loadResource: function(uri, callback) {...implement me...};
     *      suggestedTemplate: function(uri, graph) {... implement me...};
     *      }, someNode);
     */
    return declare([_LayoutWidget, _TemplatedMixin, _WidgetsInTemplateMixin], {
        itemStore: null,
        initialURI: "",
        exampleURIs: null,
        type2template: null,
        pattern2template: null,
        bundlePaths: null,
        keyInFragment: "uri",
        rdf: null,
        rdfFormat: "rdf/json",
        graph: null,
        proxyLoadResourcePattern: null,
        proxyLoadResourcePattern2: null,
	loadResourceMessage: "Loading Resource",
	loadResourceMessage2: "Loading Resource via secondary mechanism",
	loadResourceFailed: "Failed to load resource",

        showResource: function(uri) {
            this.textboxURI.set("value", uri);
            this.loadResource(uri).then(lang.hitch(this, function(graph) {
                this._showBrowse(uri, graph);
                this._rdfTab.setGraph(graph);
            }));
        },
	showOrUpdateLoadProgress: function(message) {
	    if (!this._progressDialog) {
		var node = domConstruct.create("div", {style: {"width": "400px", "height": "100px"}});
		this._progressMessage = domConstruct.create("div", {"class": "progressMessage"}, node);
		this._progressBar = new ProgressBar({value: "infinity", indeterminate: true}, domConstruct.create("div", null, node));
		this._progressDialog = new Dialog();
		this._progressDialog.setContent(node);
	    }
	    domAttr.set(this._progressMessage, "innerHTML", message);
	    this._progressDialog.show();
	},
	endLoadProgress: function() {
	    this._progressDialog.hide();
	},
	failedLoadProgress: function(message) {
	    this._progressDialog.hide();
	    alert(this.loadResourceFailed);
	},
        loadResource: function(uri, secondAttempt) {
	    var pattern = secondAttempt === true ? this.proxyLoadResourcePattern2 : this.proxyLoadResourcePattern;
            if (pattern) {
                var url = lang.replace(pattern, {uri: encodeURIComponent(uri)});
                var params;
                switch(this.rdfFormat) {
                    case "rdf/xml":
                        params = {headers: {"Accept": "application/rdf+xml"}, handleAs: "string"};
                        break;
                    case "rdf/json":
                    default:
                    params = {headers: {"Accept": "application/rdf+json"}, handleAs: "json"};
                }
		this.showOrUpdateLoadProgress(secondAttempt ? this.loadResourceMessage2 : this.loadResourceMessage);
                return request.get(url, params).then(lang.hitch(this, function(data) {
                    this.endLoadProgress();
		    return this._convertRDF(data);
                }), lang.hitch(this, function(err) {
		    if (secondAttempt === true || this.proxyLoadResourcePattern2 == null) {
			this.failedLoadProgress();
		    } else {
			return this.loadResource(uri, true);
		    }
                }));
            } else if (this.graph) {
                var d = new Deferred();
                d.resolve(this.graph);
                return d.promise;
            } else {
                console.warn("Loading of resource failed, you need to either set a proxyLoadResourcePattern, " +
                    "provide a graph or rdfjsonGraph, or override the method loadResource in LDBrowser.");
            }
        },
        loadJSON: function(uri) {
            return request.get(uri, {handleAs: "json"});
        },
        suggestedTemplate: function(uri, graph) {
            if (this.pattern2template) {
                for (var key in this.pattern2template) if (this.pattern2template.hasOwnProperty(key)) {
                    if (new RegExp(key).test(uri)) {
                        return this.pattern2template[key];
                    }
                }
            }
            if (this.type2template) {
                var stmts = graph.find(uri, "http://www.w3.org/1999/02/22-rdf-syntax-ns#type");
                for (var i = 0;i<stmts.length;i++) {
                    var template = this.type2template[stmts[i].getValue()];
                    if (template != null) {
                        return template;
                    }
                }
            }
            if (this.defaultTemplate) {
                return this.defaultTemplate;
            }
        },

        //===================================================
        // Inherited attributes, methods or private methods
        //===================================================
        templateString: template,
        _graph: null,
        _presenterTab: null, //From template
        _rdfTab: null, //From template

        postCreate: function() {
            this.inherited("postCreate", arguments);

            if (this.itemStore == null) {
                this.itemStore = new ItemStore();
            }

            var self = this;
            var f = function() {
                system.attachLinkBehaviour = function (node, binding) {
                    on(node, "click", function (e) {
                        e.preventDefault();
                        var obj = ioQuery.queryToObject(hash());
                        obj[self.keyInFragment] = binding.getValue();
                        hash(ioQuery.objectToQuery(obj));
                    });
                };

                var f = function () {
                    var obj = ioQuery.queryToObject(hash());
                    if (obj[self.keyInFragment]) {
                        self.showResource(obj[self.keyInFragment]);
                    } else if (self.initialURI) {
                        obj[self.keyInFragment] = self.initialURI;
                        hash(ioQuery.objectToQuery(obj));
                    }
                };
                topic.subscribe("/dojo/hashchange", f);
                setTimeout(f, 1);
            };

            var g = lang.hitch(this, function(config) {
                lang.mixin(this, this.config, config);
                this._convertRDF(this.rdf);

                if (this.exampleURIs) {
                    domStyle.set(this.examplesBlock, "display", "");
                    domStyle.set(this._borderContainer.domNode, "top", "55");
                    array.forEach(this.exampleURIs, function(exURI) {
                        var a = domConstruct.create("a", {href: exURI, innerHTML: exURI}, this.examples);
                        domConstruct.create("span", {innerHTML: ", "}, this.examples);
                        on(a, "click", function(e) {
                            e.preventDefault();
                            var obj = ioQuery.queryToObject(hash());
                            obj[self.keyInFragment] = exURI;
                            hash(ioQuery.objectToQuery(obj));
                        });
                    }, this);
                }

                if (this.bundlePaths != null && this.bundlePaths != null) {
                    all(array.map(this.bundlePaths, function(bundlePath) {
                        return this.loadJSON(bundlePath);
                    }, this)).then(lang.hitch(this, function(results) {
                        array.forEach(results, function(bundle, idx) {
                            this.itemStore.registerBundle({path: this.bundlePaths[idx], source: bundle});
                        }, this);
                        f();
                    }));
                } else {
                    f();
                }
            });

            if (this.configPath) {
                var path = this.configPath.substring(0, this.configPath.lastIndexOf("/"));
                this.loadJSON(this.configPath).then(function(config) {
                    if (path !== "" && config.bundlePaths != null) {
                        config.bundlePaths = array.map(config.bundlePaths, function(bpath) {
                            return path+bpath;
                        });
                    }
                    g(config);
                });
            } else {
                g();
            }
            this.startup();
        },
        resize: function( ){
            this.inherited("resize", arguments);
            if (this._borderContainer) {
                this._borderContainer.resize();
            }
        },
        _convertRDF: function(rdf) {
            this.rdf = rdf;
            if (this.rdf != null) {
                switch(this.rdfFormat) {
                    case "rdf/json":
                        return this.graph = new Graph(this.rdf, false);
                    case "rdf/xml":
                        return this.graph = converters.rdfxml2graph(this.rdf);
                }
            }
        },
        _showBrowse: function(uri, graph) {
            var requiredItems = this.suggestedTemplate(uri, graph) || [];
            if (lang.isString(requiredItems)) {
                requiredItems = [requiredItems];
            }
            var template = Engine.constructTemplate(graph, uri, this.itemStore, requiredItems);
            var binding = Engine.match(graph, uri, template);
            this.presenter.show({binding: binding});
        },
        _uriKeypress: function(ev) {
            if (ev.keyCode === keys.ENTER) {
                var obj = ioQuery.queryToObject(hash());
                obj[this.keyInFragment] = this.textboxURI.get("value");
                hash(ioQuery.objectToQuery(obj));
            }
        },
        _loadConfig: function(configPath) {

        }
    });
});

},
'dijit/ProgressBar':function(){
define([
	"require", // require.toUrl
	"dojo/_base/declare", // declare
	"dojo/dom-class", // domClass.toggle
	"dojo/_base/lang", // lang.mixin
	"dojo/number", // number.format
	"./_Widget",
	"./_TemplatedMixin",
	"dojo/text!./templates/ProgressBar.html"
], function(require, declare, domClass, lang, number, _Widget, _TemplatedMixin, template){

	// module:
	//		dijit/ProgressBar

	return declare("dijit.ProgressBar", [_Widget, _TemplatedMixin], {
		// summary:
		//		A progress indication widget, showing the amount completed
		//		(often the percentage completed) of a task.

		// progress: [const] String (Percentage or Number)
		//		Number or percentage indicating amount of task completed.
		//		Deprecated.   Use "value" instead.
		progress: "0",

		// value: String (Percentage or Number)
		//		Number or percentage indicating amount of task completed.
		//		With "%": percentage value, 0% <= progress <= 100%, or
		//		without "%": absolute value, 0 <= progress <= maximum.
		//		Infinity means that the progress bar is indeterminate.
		value: "",

		// maximum: [const] Float
		//		Max sample number
		maximum: 100,

		// places: [const] Number
		//		Number of places to show in values; 0 by default
		places: 0,

		// indeterminate: [const] Boolean
		//		If false: show progress value (number or percentage).
		//		If true: show that a process is underway but that the amount completed is unknown.
		//		Deprecated.   Use "value" instead.
		indeterminate: false,

		// label: String?
		//		HTML label on progress bar.   Defaults to percentage for determinate progress bar and
		//		blank for indeterminate progress bar.
		label: "",

		// name: String
		//		this is the field name (for a form) if set. This needs to be set if you want to use
		//		this widget in a dijit/form/Form widget (such as dijit/Dialog)
		name: '',

		templateString: template,

		// _indeterminateHighContrastImagePath: [private] URL
		//		URL to image to use for indeterminate progress bar when display is in high contrast mode
		_indeterminateHighContrastImagePath: require.toUrl("./themes/a11y/indeterminate_progress.gif"),

		postMixInProperties: function(){
			this.inherited(arguments);

			// Back-compat for when constructor specifies indeterminate or progress, rather than value.   Remove for 2.0.
			if(!(this.params && "value" in this.params)){
				this.value = this.indeterminate ? Infinity : this.progress;
			}
		},

		buildRendering: function(){
			this.inherited(arguments);
			this.indeterminateHighContrastImage.setAttribute("src",
				this._indeterminateHighContrastImagePath.toString());
			this.update();
		},

		_setDirAttr: function(val){
			// Normally _CssStateMixin takes care of this, but we aren't extending it
			domClass.toggle(this.domNode, "dijitProgressBarRtl", val == "rtl");
			this.inherited(arguments);
		},

		update: function(/*Object?*/attributes){
			// summary:
			//		Internal method to change attributes of ProgressBar, similar to set(hash).  Users should call
			//		set("value", ...) rather than calling this method directly.
			// attributes:
			//		May provide progress and/or maximum properties on this parameter;
			//		see attribute specs for details.
			// example:
			//	|	myProgressBar.update({'indeterminate': true});
			//	|	myProgressBar.update({'progress': 80});
			//	|	myProgressBar.update({'indeterminate': true, label:"Loading ..." })
			// tags:
			//		private

			// TODO: deprecate this method and use set() instead

			lang.mixin(this, attributes || {});
			var tip = this.internalProgress, ap = this.domNode;
			var percent = 1;
			if(this.indeterminate){
				ap.removeAttribute("aria-valuenow");
			}else{
				if(String(this.progress).indexOf("%") != -1){
					percent = Math.min(parseFloat(this.progress) / 100, 1);
					this.progress = percent * this.maximum;
				}else{
					this.progress = Math.min(this.progress, this.maximum);
					percent = this.maximum ? this.progress / this.maximum : 0;
				}
				ap.setAttribute("aria-valuenow", this.progress);
			}

			// Even indeterminate ProgressBars should have these attributes
			ap.setAttribute("aria-labelledby", this.labelNode.id);
			ap.setAttribute("aria-valuemin", 0);
			ap.setAttribute("aria-valuemax", this.maximum);

			this.labelNode.innerHTML = this.report(percent);

			domClass.toggle(this.domNode, "dijitProgressBarIndeterminate", this.indeterminate);
			tip.style.width = (percent * 100) + "%";
			this.onChange();
		},

		_setValueAttr: function(v){
			this._set("value", v);
			if(v == Infinity){
				this.update({indeterminate: true});
			}else{
				this.update({indeterminate: false, progress: v});
			}
		},

		_setLabelAttr: function(label){
			this._set("label", label);
			this.update();
		},

		_setIndeterminateAttr: function(indeterminate){
			// Deprecated, use set("value", ...) instead
			this._set("indeterminate", indeterminate);
			this.update();
		},

		report: function(/*float*/percent){
			// summary:
			//		Generates HTML message to show inside progress bar (normally indicating amount of task completed).
			//		May be overridden.
			// tags:
			//		extension

			return this.label ? this.label :
				(this.indeterminate ? "&#160;" : number.format(percent, { type: "percent", places: this.places, locale: this.lang }));
		},

		onChange: function(){
			// summary:
			//		Callback fired when progress updates.
			// tags:
			//		extension
		}
	});
});

},
'dojo/hash':function(){
define(["./_base/kernel", "require", "./_base/config", "./aspect", "./_base/lang", "./topic", "./domReady", "./sniff"],
	function(dojo, require, config, aspect, lang, topic, domReady, has){

	// module:
	//		dojo/hash

	dojo.hash = function(/* String? */ hash, /* Boolean? */ replace){
		// summary:
		//		Gets or sets the hash string in the browser URL.
		// description:
		//		Handles getting and setting of location.hash.
		//
		//		 - If no arguments are passed, acts as a getter.
		//		 - If a string is passed, acts as a setter.
		// hash:
		//		the hash is set - #string.
		// replace:
		//		If true, updates the hash value in the current history
		//		state instead of creating a new history state.
		// returns:
		//		when used as a getter, returns the current hash string.
		//		when used as a setter, returns the new hash string.
		// example:
		//	|	topic.subscribe("/dojo/hashchange", context, callback);
		//	|
		//	|	function callback (hashValue){
		//	|		// do something based on the hash value.
		//	|	}

		// getter
		if(!arguments.length){
			return _getHash();
		}
		// setter
		if(hash.charAt(0) == "#"){
			hash = hash.substring(1);
		}
		if(replace){
			_replace(hash);
		}else{
			location.href = "#" + hash;
		}
		return hash; // String
	};

	// Global vars
	var _recentHash, _ieUriMonitor, _connect,
		_pollFrequency = config.hashPollFrequency || 100;

	//Internal functions
	function _getSegment(str, delimiter){
		var i = str.indexOf(delimiter);
		return (i >= 0) ? str.substring(i+1) : "";
	}

	function _getHash(){
		return _getSegment(location.href, "#");
	}

	function _dispatchEvent(){
		topic.publish("/dojo/hashchange", _getHash());
	}

	function _pollLocation(){
		if(_getHash() === _recentHash){
			return;
		}
		_recentHash = _getHash();
		_dispatchEvent();
	}

	function _replace(hash){
		if(_ieUriMonitor){
			if(_ieUriMonitor.isTransitioning()){
				setTimeout(lang.hitch(null,_replace,hash), _pollFrequency);
				return;
			}
			var href = _ieUriMonitor.iframe.location.href;
			var index = href.indexOf('?');
			// main frame will detect and update itself
			_ieUriMonitor.iframe.location.replace(href.substring(0, index) + "?" + hash);
			return;
		}
		location.replace("#"+hash);
		!_connect && _pollLocation();
	}

	function IEUriMonitor(){
		// summary:
		//		Determine if the browser's URI has changed or if the user has pressed the
		//		back or forward button. If so, call _dispatchEvent.
		//
		// description:
		//		IE doesn't add changes to the URI's hash into the history unless the hash
		//		value corresponds to an actual named anchor in the document. To get around
		//		this IE difference, we use a background IFrame to maintain a back-forward
		//		history, by updating the IFrame's query string to correspond to the
		//		value of the main browser location's hash value.
		//
		//		E.g. if the value of the browser window's location changes to
		//
		//		#action=someAction
		//
		//		... then we'd update the IFrame's source to:
		//
		//		?action=someAction
		//
		//		This design leads to a somewhat complex state machine, which is
		//		described below:
		//
		//		####s1
		//
		//		Stable state - neither the window's location has changed nor
		//		has the IFrame's location. Note that this is the 99.9% case, so
		//		we optimize for it.
		//
		//		Transitions: s1, s2, s3
		//
		//		####s2
		//
		//		Window's location changed - when a user clicks a hyperlink or
		//		code programmatically changes the window's URI.
		//
		//		Transitions: s4
		//
		//		####s3
		//
		//		Iframe's location changed as a result of user pressing back or
		//		forward - when the user presses back or forward, the location of
		//		the background's iframe changes to the previous or next value in
		//		its history.
		//
		//		Transitions: s1
		//
		//		####s4
		//
		//		IEUriMonitor has programmatically changed the location of the
		//		background iframe, but it's location hasn't yet changed. In this
		//		case we do nothing because we need to wait for the iframe's
		//		location to reflect its actual state.
		//
		//		Transitions: s4, s5
		//
		//		####s5
		//
		//		IEUriMonitor has programmatically changed the location of the
		//		background iframe, and the iframe's location has caught up with
		//		reality. In this case we need to transition to s1.
		//
		//		Transitions: s1
		//
		//		The hashchange event is always dispatched on the transition back to s1.


		// create and append iframe
		var ifr = document.createElement("iframe"),
			IFRAME_ID = "dojo-hash-iframe",
			ifrSrc = config.dojoBlankHtmlUrl || require.toUrl("./resources/blank.html");

		if(config.useXDomain && !config.dojoBlankHtmlUrl){
			console.warn("dojo/hash: When using cross-domain Dojo builds,"
				+ " please save dojo/resources/blank.html to your domain and set djConfig.dojoBlankHtmlUrl"
				+ " to the path on your domain to blank.html");
		}

		ifr.id = IFRAME_ID;
		ifr.src = ifrSrc + "?" + _getHash();
		ifr.style.display = "none";
		document.body.appendChild(ifr);

		this.iframe = dojo.global[IFRAME_ID];
		var recentIframeQuery, transitioning, expectedIFrameQuery, docTitle, ifrOffline,
			iframeLoc = this.iframe.location;

		function resetState(){
			_recentHash = _getHash();
			recentIframeQuery = ifrOffline ? _recentHash : _getSegment(iframeLoc.href, "?");
			transitioning = false;
			expectedIFrameQuery = null;
		}

		this.isTransitioning = function(){
			return transitioning;
		};

		this.pollLocation = function(){
			if(!ifrOffline){
				try{
					//see if we can access the iframe's location without a permission denied error
					var iframeSearch = _getSegment(iframeLoc.href, "?");
					//good, the iframe is same origin (no thrown exception)
					if(document.title != docTitle){ //sync title of main window with title of iframe.
						docTitle = this.iframe.document.title = document.title;
					}
				}catch(e){
					//permission denied - server cannot be reached.
					ifrOffline = true;
					console.error("dojo/hash: Error adding history entry. Server unreachable.");
				}
			}
			var hash = _getHash();
			if(transitioning && _recentHash === hash){
				// we're in an iframe transition (s4 or s5)
				if(ifrOffline || iframeSearch === expectedIFrameQuery){
					// s5 (iframe caught up to main window or iframe offline), transition back to s1
					resetState();
					_dispatchEvent();
				}else{
					// s4 (waiting for iframe to catch up to main window)
					setTimeout(lang.hitch(this,this.pollLocation),0);
					return;
				}
			}else if(_recentHash === hash && (ifrOffline || recentIframeQuery === iframeSearch)){
				// we're in stable state (s1, iframe query == main window hash), do nothing
			}else{
				// the user has initiated a URL change somehow.
				// sync iframe query <-> main window hash
				if(_recentHash !== hash){
					// s2 (main window location changed), set iframe url and transition to s4
					_recentHash = hash;
					transitioning = true;
					expectedIFrameQuery = hash;
					ifr.src = ifrSrc + "?" + expectedIFrameQuery;
					ifrOffline = false; //we're updating the iframe src - set offline to false so we can check again on next poll.
					setTimeout(lang.hitch(this,this.pollLocation),0); //yielded transition to s4 while iframe reloads.
					return;
				}else if(!ifrOffline){
					// s3 (iframe location changed via back/forward button), set main window url and transition to s1.
					location.href = "#" + iframeLoc.search.substring(1);
					resetState();
					_dispatchEvent();
				}
			}
			setTimeout(lang.hitch(this,this.pollLocation), _pollFrequency);
		};
		resetState(); // initialize state (transition to s1)
		setTimeout(lang.hitch(this,this.pollLocation), _pollFrequency);
	}
	domReady(function(){
		if("onhashchange" in dojo.global && (!has("ie") || (has("ie") >= 8 && document.compatMode != "BackCompat"))){	//need this IE browser test because "onhashchange" exists in IE8 in IE7 mode
			_connect = aspect.after(dojo.global,"onhashchange",_dispatchEvent, true);
		}else{
			if(document.addEventListener){ // Non-IE
				_recentHash = _getHash();
				setInterval(_pollLocation, _pollFrequency); //Poll the window location for changes
			}else if(document.attachEvent){ // IE7-
				//Use hidden iframe in versions of IE that don't have onhashchange event
				_ieUriMonitor = new IEUriMonitor();
			}
			// else non-supported browser, do nothing.
		}
	});

	return dojo.hash;

});

},
'url:dijit/layout/templates/TabContainer.html':"<div class=\"dijitTabContainer\">\n\t<div class=\"dijitTabListWrapper\" data-dojo-attach-point=\"tablistNode\"></div>\n\t<div data-dojo-attach-point=\"tablistSpacer\" class=\"dijitTabSpacer ${baseClass}-spacer\"></div>\n\t<div class=\"dijitTabPaneWrapper ${baseClass}-container\" data-dojo-attach-point=\"containerNode\"></div>\n</div>\n",
'url:dijit/layout/templates/_TabButton.html':"<div role=\"presentation\" data-dojo-attach-point=\"titleNode,innerDiv,tabContent\" class=\"dijitTabInner dijitTabContent\">\n\t<span role=\"presentation\" class=\"dijitInline dijitIcon dijitTabButtonIcon\" data-dojo-attach-point=\"iconNode\"></span>\n\t<span data-dojo-attach-point='containerNode,focusNode' class='tabLabel'></span>\n\t<span class=\"dijitInline dijitTabCloseButton dijitTabCloseIcon\" data-dojo-attach-point='closeNode'\n\t\t  role=\"presentation\">\n\t\t<span data-dojo-attach-point='closeText' class='dijitTabCloseText'>[x]</span\n\t\t\t\t></span>\n</div>\n",
'url:dijit/layout/templates/ScrollingTabController.html':"<div class=\"dijitTabListContainer-${tabPosition}\" style=\"visibility:hidden\">\n\t<div data-dojo-type=\"dijit.layout._ScrollingTabControllerMenuButton\"\n\t\t class=\"tabStripButton-${tabPosition}\"\n\t\t id=\"${id}_menuBtn\"\n\t\t data-dojo-props=\"containerId: '${containerId}', iconClass: 'dijitTabStripMenuIcon',\n\t\t\t\t\tdropDownPosition: ['below-alt', 'above-alt']\"\n\t\t data-dojo-attach-point=\"_menuBtn\" showLabel=\"false\" title=\"\">&#9660;</div>\n\t<div data-dojo-type=\"dijit.layout._ScrollingTabControllerButton\"\n\t\t class=\"tabStripButton-${tabPosition}\"\n\t\t id=\"${id}_leftBtn\"\n\t\t data-dojo-props=\"iconClass:'dijitTabStripSlideLeftIcon', showLabel:false, title:''\"\n\t\t data-dojo-attach-point=\"_leftBtn\" data-dojo-attach-event=\"onClick: doSlideLeft\">&#9664;</div>\n\t<div data-dojo-type=\"dijit.layout._ScrollingTabControllerButton\"\n\t\t class=\"tabStripButton-${tabPosition}\"\n\t\t id=\"${id}_rightBtn\"\n\t\t data-dojo-props=\"iconClass:'dijitTabStripSlideRightIcon', showLabel:false, title:''\"\n\t\t data-dojo-attach-point=\"_rightBtn\" data-dojo-attach-event=\"onClick: doSlideRight\">&#9654;</div>\n\t<div class='dijitTabListWrapper' data-dojo-attach-point='tablistWrapper'>\n\t\t<div role='tablist' data-dojo-attach-event='onkeydown:onkeydown'\n\t\t\t data-dojo-attach-point='containerNode' class='nowrapTabStrip'></div>\n\t</div>\n</div>",
'url:dijit/layout/templates/_ScrollingTabControllerButton.html':"<div data-dojo-attach-event=\"ondijitclick:_onClick\" class=\"dijitTabInnerDiv dijitTabContent dijitButtonContents\"  data-dojo-attach-point=\"focusNode\" role=\"button\">\n\t<span role=\"presentation\" class=\"dijitInline dijitTabStripIcon\" data-dojo-attach-point=\"iconNode\"></span>\n\t<span data-dojo-attach-point=\"containerNode,titleNode\" class=\"dijitButtonText\"></span>\n</div>",
'url:rdforms/formulator/ItemEditorTemplate.html':"<div>\n    <div class=\"formulatorTable\">\n        <div class=\"row\"><label for=\"${id}_type\">Type:</label><div><div id=\"${id}_type\" data-dojo-type=\"dijit/form/TextBox\" data-dojo-attach-point=\"_typeDijit\" data-dojo-props=\"disabled: true\"></div></div></div>\n        <div class=\"row\"><label for=\"${id}_id\">Id:</label><div><div id=\"${id}_id\" data-dojo-type=\"dijit/form/TextBox\" data-dojo-attach-point=\"_idDijit\" data-dojo-attach-event=\"onChange: _changeId\" data-dojo-props=\"intermediateChanges: true\"></div></div></div>\n        <div class=\"row\"><label for=\"${id}_extends\">Extends:</label>\n            <div data-dojo-type=\"dojo/dnd/Target\" data-dojo-attach-point=\"_extends_target\" data-dojo-props=\"accept: ['treenode', 'text']\">\n                <div id=\"${id}_extends\" data-dojo-type=\"dijit/form/TextBox\" data-dojo-attach-point=\"_extendsDijit\" data-dojo-attach-event=\"onChange: _changeExtends\" data-dojo-props=\"intermediateChanges: true\"></div>\n            </div>\n        </div>\n        <div class=\"row\"><label for=\"${id}_property\">Property:</label><div><div id=\"${id}_property\" data-dojo-type=\"dijit/form/TextBox\" data-dojo-attach-point=\"_propDijit\" data-dojo-attach-event=\"onChange: _changeProperty\" data-dojo-props=\"intermediateChanges: true\"></div></div></div>\n        <div class=\"row\"><label for=\"${id}_nt\">NodeType:</label><div>\n            <select class=\"select\" name=\"select1\" data-dojo-type=\"dijit/form/Select\" id=\"${id}_nt\" data-dojo-attach-point=\"_ntDijit\" data-dojo-attach-event=\"onChange: _changeNT\">\n                <option value=\"LANGUAGE_LITERAL\">Literal, language mandatory</option>\n                <option value=\"PLAIN_LITERAL\">Literal, language optional</option>\n                <option value=\"ONLY_LITERAL\">Literal, language disallowed</option>\n                <option value=\"DATATYPE_LITERAL\">Datatyped literal</option>\n                <option value=\"LITERAL\" selected=\"selected\">Any kind of literal</option>\n                <option value=\"URI\">URI</option>\n                <option value=\"BLANK\">Blank node</option>\n                <option value=\"RESOURCE\">URI or blank node</option>\n            </select>\n        </div></div>\n        <div class=\"row\"><label for=\"${id}_dt\">DataType:</label><div>\n            <select class=\"select\" data-dojo-type=\"dijit/form/ComboBox\" id=\"${id}_dt\" name=\"dt\" data-dojo-attach-point=\"_dtDijit\" data-dojo-attach-event=\"onChange: _changeDT\">\n                <option selected></option>\n                <option>http://www.w3.org/2001/XMLSchema#date</option>\n                <option>http://www.w3.org/2001/XMLSchema#duration</option>\n                <option>http://www.w3.org/2001/XMLSchema#decimal</option>\n                <option>http://www.w3.org/2001/XMLSchema#integer</option>\n                <option>http://www.w3.org/2001/XMLSchema#boolean</option>\n            </select>\n        </div></div>\n        <div class=\"row\"><label for=\"${id}_pattern\">Pattern:</label><div><div id=\"${id}_pattern\" data-dojo-type=\"dijit/form/TextBox\" data-dojo-attach-point=\"_patternDijit\" data-dojo-attach-event=\"onChange: _changePattern\" data-dojo-props=\"intermediateChanges: true\"></div></div></div>\n        <div class=\"row\"><label>Label: <span data-dojo-attach-point=\"_addLabel\" class=\"addButton\">+</span></label><div>\n            <div data-dojo-attach-point=\"_labelLangString\" data-dojo-type=\"rdforms/formulator/LangString\"></div>\n        </div></div>\n        <div class=\"row\"><label>Description: <span data-dojo-attach-point=\"_addDesc\" class=\"addButton\">+</span></label><div>\n            <div data-dojo-attach-point=\"_descLangString\" data-dojo-type=\"rdforms/formulator/LangString\" data-dojo-props=\"multiline: true\"></div>\n        </div></div>\n        <div class=\"row\"><label>Cardinality: </label><div><div class=\"cardinality\">\n            <label for=\"${id}_min\">Min:</label><div id=\"${id}_min\" data-dojo-type=\"dijit/form/NumberTextBox\" data-dojo-attach-point=\"_minDijit\" data-dojo-attach-event=\"onChange: _changeCard\"></div>\n            <label for=\"${id}_pref\">Pref:</label><div id=\"${id}_pref\" data-dojo-type=\"dijit/form/NumberTextBox\" data-dojo-attach-point=\"_prefDijit\" data-dojo-attach-event=\"onChange: _changeCard\"></div>\n            <label for=\"${id}_max\">Max:</label><div id=\"${id}_max\" data-dojo-type=\"dijit/form/NumberTextBox\" data-dojo-attach-point=\"_maxDijit\" data-dojo-attach-event=\"onChange: _changeCard\"></div>\n        </div></div></div>\n        <div class=\"row\"><label for=\"${id}_constr\">Constraints:</label><div><div id=\"${id}_constr\" data-dojo-type=\"dijit/form/ValidationTextBox\" data-dojo-attach-point=\"_constrDijit\" data-dojo-attach-event=\"onChange: _changeConstr\" data-dojo-props=\"intermediateChanges: true, invalidMessage: 'Must be a valid json string.'\"></div></div></div>\n        <div class=\"row\"><label for=\"${id}_cls\">Classes:</label><div><div id=\"${id}_cls\" data-dojo-type=\"dijit/form/TextBox\" data-dojo-attach-point=\"_clsDijit\" data-dojo-attach-event=\"onChange: _changeCls\" data-dojo-props=\"intermediateChanges: true\"></div></div></div>\n        <div class=\"row\"><label for=\"${id}_sty\">Styles:</label><div><div data-dojo-attach-point=\"_stylesWrapper\">\n        </div></div></div>\n    </div>\n</div>\n",
'url:rdforms/formulator/ChoicesEditorTemplate.html':"<div>\n    <div data-dojo-type=\"dijit/layout/BorderContainer\" data-dojo-attach-point=\"_bcDijit\" style=\"height: 100%\">\n        <div data-dojo-type=\"dijit/layout/ContentPane\" data-dojo-attach-point=\"_controlDijit\" data-dojo-props=\"region: 'top', splitter: true\" style=\"height: 25px\">\n            <div class=\"formulatorTable\">\n                <div class=\"row\"><label for=\"${id}_inline\">Inline choices: </label><div><div>\n                    <div data-dojo-attach-point=\"_inlineDijit\" id=\"${id}_inline\" data-dojo-type=\"dijit/form/CheckBox\" data-dojo-attach-event=\"onChange: _changeInline\"></div>\n                </div></div></div>\n                <div class=\"row dynamic\"><label for=\"${id}_ontology\">Ontology URL:</label><div><div id=\"${id}_ontology\" data-dojo-type=\"dijit/form/TextBox\" data-dojo-attach-point=\"_ontologyDijit\" data-dojo-attach-event=\"onChange: _changeOntologyUrl\" data-dojo-props=\"intermediateChanges: true\"></div></div></div>\n                <div class=\"row dynamic\"><label for=\"${id}_hproperty\">Hierarchy property:</label><div><div id=\"${id}_hproperty\" data-dojo-type=\"dijit/form/TextBox\" data-dojo-attach-point=\"_hpDijit\" data-dojo-attach-event=\"onChange: _changeHProperty\" data-dojo-props=\"intermediateChanges: true\"></div></div></div>\n                <div class=\"row dynamic\"><label for=\"${id}_hpinv\">is inverted: </label><div><div>\n                    <div data-dojo-attach-point=\"_hpinvDijit\" id=\"${id}_hpinv\" data-dojo-type=\"dijit/form/CheckBox\" data-dojo-attach-event=\"onChange: _changeHPI\"></div>\n                </div></div></div>\n                <div class=\"row dynamic\"><label for=\"${id}_pproperty\">Parent property:</label><div><div id=\"${id}_pproperty\" data-dojo-type=\"dijit/form/TextBox\" data-dojo-attach-point=\"_ppDijit\" data-dojo-attach-event=\"onChange: _changePProperty\" data-dojo-props=\"intermediateChanges: true\"></div></div></div>\n                <div class=\"row dynamic\"><label for=\"${id}_ppinv\">is inverted: </label><div><div>\n                    <div data-dojo-attach-point=\"_ppinvDijit\" id=\"${id}_ppinv\" data-dojo-type=\"dijit/form/CheckBox\" data-dojo-attach-event=\"onChange: _changePPI\"></div>\n                </div></div></div>\n            </div>\n        </div>\n        <div data-dojo-type=\"dijit/layout/ContentPane\" data-dojo-props=\"region: 'center'\">\n            <div data-dojo-attach-point=\"_treeNode\"></div>\n        </div>\n        <div data-dojo-type=\"dijit/layout/ContentPane\" data-dojo-props=\"region: 'bottom', splitter: true\" style=\"height: 35%\">\n            <div class=\"formulatorTable\">\n                <div class=\"row\"><label for=\"${id}_value\">Value:</label><div><div id=\"${id}_value\" data-dojo-type=\"dijit/form/ValidationTextBox\" data-dojo-attach-point=\"_valueDijit\" data-dojo-attach-event=\"onChange: _changeValue\" data-dojo-props=\"intermediateChanges: true, invalidMessage: 'Value must be unique.'\"></div></div></div>\n                <div class=\"row\"><label>Label: <span data-dojo-attach-point=\"_addLabel\" class=\"addButton\">+</span></label><div>\n                    <div data-dojo-attach-point=\"_labelLangString\" data-dojo-type=\"rdforms/formulator/LangString\"></div>\n                </div></div>\n                <div class=\"row\"><label>Description: <span data-dojo-attach-point=\"_addDesc\" class=\"addButton\">+</span></label><div>\n                    <div data-dojo-attach-point=\"_descLangString\" data-dojo-type=\"rdforms/formulator/LangString\" data-dojo-props=\"multiline: true\"></div>\n                </div></div>\n                <div class=\"row\"><label>Selectable: </label><div><div>\n                    <div data-dojo-attach-point=\"_selectable\" data-dojo-type=\"dijit/form/CheckBox\" data-dojo-attach-event=\"onChange: _changeSelectable\"></div>\n                </div></div></div>\n            </div>\n        </div>\n    </div>\n</div>\n",
'url:rdforms/apps/RDFViewTemplate.html':"<div>\n    <div data-dojo-type='dijit/layout/TabContainer' data-dojo-attach-point='_tabContainer' style='height: 100%' data-dojo-props=\"nested: true\">\n        <div data-dojo-type='dijit/layout/ContentPane' title='RDF/XML' data-dojo-attach-point='_rdfxmlTab'>\n            <div data-dojo-type='dijit/form/SimpleTextarea' data-dojo-attach-point='_rdfxml' style='padding: 0px; margin: 0px;height: 100%; width: 100%; overflow:auto;border-width:0px;'></div>\n        </div>\n        <div data-dojo-type='dijit/layout/ContentPane' title='RDF/JSON' data-dojo-attach-point='_rdfjsonTab'>\n            <div data-dojo-type='dijit/form/SimpleTextarea' data-dojo-attach-point='_rdfjson' style='padding: 0px; margin: 0px;height: 100%; width: 100%; overflow:auto;border-width:0px;'></div>\n        </div>\n    </div>\n</div>\n",
'url:rdforms/apps/ExperimentTemplate.html':"<div>\n  <div data-dojo-type='dijit/layout/TabContainer' data-dojo-attach-point='_tabContainer' style='height: 100%' data-dojo-props=\"gutters:false\">\n    <div data-dojo-type='dijit/layout/ContentPane' title='Editor' data-dojo-props=\"selected:'true'\" data-dojo-attach-point='_editorTab'>\n        <div data-dojo-type=\"rdforms/view/Editor\" data-dojo-attach-point=\"editor\" data-dojo-props=\"compact: true,includeLevel: 'optional'\"></div>\n    </div>\n    <div data-dojo-type='dijit/layout/ContentPane' title='Presenter' data-dojo-attach-point='_presenterTab'>\n        <div data-dojo-type=\"rdforms/view/Presenter\" data-dojo-attach-point=\"presenter\" data-dojo-props=\"compact: true\"></div>\n    </div>\n    <div data-dojo-type='dijit/layout/ContentPane' title='Template' data-dojo-attach-point='_templateTab'>\n      <div data-dojo-type='dijit/form/SimpleTextarea' data-dojo-attach-point='_templateView' style='padding: 0px; margin: 0px;height: 100%; width: 100%; overflow:auto;'></div>\n    </div>\n    <div data-dojo-type='rdforms/apps/RDFView' title='RDF data' data-dojo-attach-point='_rdfTab'></div>\n  </div>\n</div>\n",
'url:rdforms/formulator/StoreManagerTemplate.html':"<div class=\"storeManager\">\n    <div data-dojo-type=\"dijit/layout/BorderContainer\" data-dojo-attach-point=\"_bcDijit\" style=\"height: 100%\" data-dojo-props=\"gutters: false\">\n        <div data-dojo-type=\"dijit/layout/TabContainer\" data-dojo-props=\"region:'center', gutters:true\" data-dojo-attach-point=\"_tabsDijit\" style=\"padding-top: 5px\">\n            <div data-dojo-type=\"dijit/layout/ContentPane\" title=\"Template editor\" data-dojo-attach-point=\"_itemEditorTab\">\n                <div data-dojo-attach-point=\"_editorNode\"></div>\n            </div>\n            <div data-dojo-type=\"dijit/layout/ContentPane\" title=\"Template choices\" data-dojo-attach-point=\"_choicesTab\">\n                <div data-dojo-attach-point=\"_choicesNode\"></div>\n            </div>\n            <div data-dojo-type=\"dijit/layout/ContentPane\" title=\"Template source\">\n                <textarea readonly data-dojo-attach-point=\"_contentsNode\" class=\"maximized_textarea\"></textarea>\n            </div>\n        </div>\n        <div data-dojo-type=\"dijit/layout/BorderContainer\" data-dojo-props=\"region:'left', gutters: false,splitter:true\" style=\"width: 20%;background: rgb(245, 245, 245);\">\n            <div data-dojo-type=\"dijit/layout/ContentPane\" data-dojo-props=\"region:'bottom',splitter: false\">\n                <div data-dojo-type=\"dijit/form/Button\" data-dojo-attach-point=\"_saveAllButton\" data-dojo-attach-event=\"onClick: _saveTemplates\" style=\"float:right\">Save</div>\n            </div>\n            <div data-dojo-type=\"dijit/layout/ContentPane\" data-dojo-props=\"region:'center',splitter: false\">\n                <div data-dojo-attach-point=\"_treeNode\" style=\"height: 100%;overflow-y: auto\" class=\"itemList\"></div>\n            </div>\n        </div>\n        <div data-dojo-type=\"dijit/layout/ContentPane\" data-dojo-props=\"region:'right',splitter:true, gutters: false\" style=\"width:40%;padding:5px 0px 0px 0px\">\n            <div data-dojo-attach-point=\"_previewNode\" style=\"height:100%;overflow-y:auto;\"></div>\n        </div>\n    </div>\n</div>\n",
'url:rdforms/apps/ValidatorTemplate.html':"<div class='validator'>\n  <div data-dojo-type='dijit.TitlePane' title='RDF/JSON source' data-dojo-props=\"open: ${rdfjsonEditorOpen}\">\n    <div data-dojo-type='dijit.form.SimpleTextarea' data-dojo-attach-point='_rdfjsonDijit' style='width:100%;height:200px'></div>\n    <div data-dojo-type='dijit.form.Button' data-dojo-props=\"label:'Update'\" dojoAttachEvent='onClick:_update'></div>\n  </div>\n  <div class='json' data-dojo-attach-point='_jsonNode'></div>\n  <div class='rdfjson' data-dojo-attach-point='_rdfjsonNode'></div>\n  <div class='rforms' data-dojo-attach-point='_rformsNode'></div>\n</div>\n",
'url:dijit/templates/ProgressBar.html':"<div class=\"dijitProgressBar dijitProgressBarEmpty\" role=\"progressbar\"\n\t><div  data-dojo-attach-point=\"internalProgress\" class=\"dijitProgressBarFull\"\n\t\t><div class=\"dijitProgressBarTile\" role=\"presentation\"></div\n\t\t><span style=\"visibility:hidden\">&#160;</span\n\t></div\n\t><div data-dojo-attach-point=\"labelNode\" class=\"dijitProgressBarLabel\" id=\"${id}_label\"></div\n\t><span data-dojo-attach-point=\"indeterminateHighContrastImage\"\n\t\t   class=\"dijitInline dijitProgressBarIndeterminateHighContrastImage\"></span\n></div>\n",
'url:rdforms/apps/LDBrowserTemplate.html':"<div class=\"ldbrowser\">\n  <div style='height: 100%;position: relative'>\n      <div style=\"font-size: large; margin: 0px 5px\">\n          <div style=\"display: table;width: 100%\"><div style=\"display: table-row\">\n              <div style=\"display:table-cell;width:1px;padding-right: 1em\">Resource:</div>\n              <div style=\"display:table-cell;width: auto\">\n                  <div style=\"width: 100%;box-sizing: border-box;padding: 0px 5px\" data-dojo-type=\"dijit/form/TextBox\"\n                       data-dojo-attach-point=\"textboxURI\" data-dojo-props=\"trim: true\" data-dojo-attach-event=\"onKeyPress: _uriKeypress\"></div></div>\n          </div></div>\n      </div>\n      <div style=\"display:none;margin: 5px;\" data-dojo-attach-point=\"examplesBlock\">\n          <span>Example resources: </span>\n          <span data-dojo-attach-point=\"examples\"></span>\n      </div>\n      <div data-dojo-type=\"dijit/layout/BorderContainer\" data-dojo-attach-point=\"_borderContainer\" style=\"position:absolute; top: 35px;bottom: 0px; left: 0px; right: 0px\">\n          <div data-dojo-type='dijit/layout/TabContainer' data-dojo-attach-point='_tabContainer' data-dojo-props=\"region: 'center'\">\n              <div data-dojo-type='dijit/layout/ContentPane' title='Browser' data-dojo-attach-point='_presenterTab'>\n                  <div data-dojo-type=\"rdforms/view/Presenter\" data-dojo-attach-point=\"presenter\" data-dojo-props=\"compact: true\"></div>\n              </div>\n              <div data-dojo-type='rdforms/apps/RDFView' title='RDF data' data-dojo-attach-point='_rdfTab'></div>\n          </div>\n      </div>\n  </div>\n</div>\n"}});
define("rdforms/extras", [], 1);
