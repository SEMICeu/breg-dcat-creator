require({cache:{
'url:rdforms/view/DurationPresentationTemplate.html':"<div>\n  <span data-dojo-attach-point=\"yearsLabelNode\">Years</span>&nbsp;<span data-dojo-attach-point=\"yearsNode\" style=\"width: 4em;\">0</span>\n  &nbsp;&nbsp;<span data-dojo-attach-point=\"monthsLabelNode\">Months</span>&nbsp;<span data-dojo-attach-point=\"monthsNode\" style=\"width: 4em;\">0</span>\n  &nbsp;&nbsp;<span data-dojo-attach-point=\"daysLabelNode\">Days</span>&nbsp;<span data-dojo-attach-point=\"daysNode\" style=\"width: 4em;\">0</span>\n  &nbsp;&nbsp;<span data-dojo-attach-point=\"hoursLabelNode\">Hours</span>&nbsp;<span data-dojo-attach-point=\"hoursNode\" style=\"width: 4em;\">0</span>\n  &nbsp;&nbsp;<span data-dojo-attach-point=\"minutesLabelNode\">Minutes</span>&nbsp;<span data-dojo-attach-point=\"minutesNode\" style=\"width: 4em;\">0</span>\n</div>\n"}});
/*global define*/
define("rdforms/view/DurationPresentation", ["dojo/_base/declare",
    "dijit/_WidgetBase",
	"dijit/_TemplatedMixin", 
	"dojo/text!./DurationPresentationTemplate.html"
], function(declare, _WidgetBase, _TemplatedMixin, template) {

    return declare([_WidgetBase, _TemplatedMixin], {
	templateString: template,

	yearsLabel: "", _setYearsLabelAttr: {node: "yearsLabelNode", type: "innerHTML"},
	monthsLabel: "", _setMonthsLabelAttr: {node: "monthsLabelNode", type: "innerHTML"},
	daysLabel: "", _setDaysLabelAttr: {node: "daysLabelNode", type: "innerHTML"},
	hoursLabel: "", _setHoursLabelAttr: {node: "hoursLabelNode", type: "innerHTML"},
	minutesLabel: "", _setMinutesLabelAttr: {node: "minutesLabelNode", type: "innerHTML"},
	years: 0, _setYearsAttr: {node: "yearsNode", type: "innerHTML"},
	months: 0, _setMonthsAttr: {node: "monthsNode", type: "innerHTML"},
	days: 0, _setDaysAttr: {node: "daysNode", type: "innerHTML"},
	hours: 0, _setHoursAttr: {node: "hoursNode", type: "innerHTML"},
	minutes: 0, _setMinutesAttr: {node: "minutesNode", type: "innerHTML"},
	
	_setValueAttr: function(value) {
		var f = function(value) {
			return value && value.length > 1 ? parseInt(value[0], 10) : 0;
		}
		this.set("years", f(value.match(/([0-9])*Y/)));
		this.set("days", f(value.match(/([0-9])*D/)));
		this.set("hours", f(value.match(/([0-9])*H/)));
		if (value.indexOf("T") == -1) {
			this.set("months", f(value.match(/([0-9])*M/)));
		} else {
			var arr = value.split("T");
			this.set("months", f(arr[0].match(/([0-9])*M/)));
			this.set("minutes", f(arr[1].match(/([0-9])*M/)));
		}
	}
    });
});
    
