/*
   Copyright 2010-2012 Portland Transport

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

var streetcarByLine = {}; // keep state

streetcarByLine.paging_state = {}; // paging state
streetcarByLine.paging_state.next_row = undefined;
streetcarByLine.paging_state.page_number = 0;
streetcarByLine.standing_messages = new Array;
streetcarByLine.connection_health = 1;
streetcarByLine.service_messages = [];
streetcarByLine.minutes_limit = 0;
streetcarByLine.arrivals_limit = 0;
streetcarByLine.rotation_complete = true;
streetcarByLine.isChumby = navigator.userAgent.match(/QtEmb/) != null;
streetcarByLine.animation_factor = 0.85; // arbitrary value to allow for pause time plus javascript processing time, will be dynamically adjusted
streetcarByLine.messages = [];
streetcarByLine.car2go = false;

streetcarByLine.standing_messages.push("<span>TransitBoard&trade; is a product of Portland Transport.</span>");
streetcarByLine.standing_messages.push("<span>Learn more at http://transitappliance.com</span>");
streetcarByLine.standing_messages.push("<span>Photo courtesy Team Team, Inc.</span>");

streetcarByLine.formatted_arrival_time = function(arrival) {
	var displayTime = "";
	var milliseconds_until_arrival = arrival.arrivalTime - new Date();
	
	var minutes_until_arrival = Math.round(milliseconds_until_arrival/60000);
	if (minutes_until_arrival == 0) {
		minutes_until_arrival = "Due";
	} else {
		minutes_until_arrival = "<nobr>"+minutes_until_arrival+" min</nobr>"; 
	}
	if (arrival.type == 'scheduled') {
		timeclass = ' scheduled';
		var sched_date = localTime(arrival.arrivalTime);
		displayTime = sched_date.toString('h:mmtt');
		displayTime = displayTime.replace(/^0:/,'12:');
	} else {
		displayTime = minutes_until_arrival;
		timeclass = "";
	}
	
	return displayTime;
}

streetcarByLine.resetMessageQueue = function() {
	streetcarByLine.messages = [];
	for (var i = 0; i < streetcarByLine.standing_messages.length; i++) {
		streetcarByLine.messages.push(streetcarByLine.standing_messages[i]);
	}
	// raw score: messages.push('<span style="font-weight: bold; color: red">['+streetcarByLine.connection_health+']</span>');
	if (streetcarByLine.connection_health < 0.2) {
		streetcarByLine.messages.push('<span style="font-weight: bold; color: red">This display has lost connectivity.</span>');
		trLoader(streetcarByLine.appliance_id);
	} else if (streetcarByLine.connection_health < 0.5) {
		streetcarByLine.messages.push('<span style="font-weight: bold; color: red">This display is experencing severe connection issues.</span>');
	} else if (streetcarByLine.connection_health < 0.8) {
		streetcarByLine.messages.push('<span style="font-weight: bold; color: red">This display is experencing connection issues.</span>');
	}
	for (var i = 0; i < streetcarByLine.service_messages.length; i++) {
		streetcarByLine.messages.push('<span style="font-weight: bold; color: red">'+streetcarByLine.service_messages[i]+'</span>');
	}
	var dimensions = jQuery(window).width()+"x"+jQuery(window).height()
  streetcarByLine.messages.push("<span style=\"font-size: 60%\">["+streetcarByLine.appliance_id+" "+dimensions+" "+streetcarByLine.animation_factor+"]</span>");
}

streetcarByLine.advanceMessage = function() {
	if (streetcarByLine.messages.length != 0) {
		var message = streetcarByLine.messages.shift();
		jQuery("div.scroller").fadeOut("slow",function() {
			jQuery("div.scroller").html("<table><tr><td align=\"center\">"+message+"</td></tr></table>");
			jQuery("div.scroller").fadeIn("slow");
		});
	}
	if (streetcarByLine.messages.length == 0) {
		streetcarByLine.resetMessageQueue();
	}
}

streetcarByLine.initializePage = function(data) {	
	
	// check for Chumby screen resolutions and mark a class in the body tag
	if ( streetcarByLine.isChumby ) {
		jQuery("body").addClass("chumby");
	}
	
	

	// kill the logging element
	jQuery("#arrivals_log_area").remove();
	
	streetcarByLine.displayInterval = data.displayInterval;
	
	//set up car2go if we have lat and lng
	
	if (data.optionsConfig != undefined && data.optionsConfig.lat != undefined && data.optionsConfig.lat[0] != undefined) {
		if (data.optionsConfig.lng != undefined && data.optionsConfig.lng[0] != undefined) {
			streetcarByLine.car2go = true;
			streetcarByLine.cars = new trCar2Go({
				lat: data.optionsConfig.lat[0],
				lng: data.optionsConfig.lng[0],
				loc: 'portland',
				consumer_key: 'TransitAppliance',
				num_vehicles: 2
			});
		}
	}
	
	
	if (data.applianceConfig != undefined && data.applianceConfig.id != undefined && data.applianceConfig.id[0] != undefined) {
		streetcarByLine.appliance_id = data.applianceConfig.id[0];
	} else {
		streetcarByLine.appliance_id = "Unassigned";
	}
	
	if (data.optionsConfig.banner != undefined && data.optionsConfig.banner[0] != undefined) {
		document.title = "Transit Board(tm) for "+data.optionsConfig.banner[0];
		streetcarByLine.banner = data.optionsConfig.banner[0];
	} else {
		streetcarByLine.banner = "";
	}
	
	if (data.optionsConfig.minutes_limit != undefined && data.optionsConfig.minutes_limit[0] != undefined && data.optionsConfig.minutes_limit[0] != 0) {
		streetcarByLine.minutes_limit = data.optionsConfig.minutes_limit[0];
	}
	if (streetcarByLine.minutes_limit == 0) {
		streetcarByLine.minutes_limit = 60;
	}
	
	if (data.optionsConfig.arrivals_limit != undefined && data.optionsConfig.arrivals_limit[0] != undefined && data.optionsConfig.arrivals_limit[0] != 0) {
		streetcarByLine.arrivals_limit = data.optionsConfig.arrivals_limit[0];
	}
	
	if (data.optionsConfig['split-by-direction'] != undefined && data.optionsConfig['split-by-direction'][0] != undefined && data.optionsConfig['split-by-direction'][0] != 0) {
		streetcarByLine.split_by_direction = true;
	} else {
		streetcarByLine.split_by_direction = false;
	}
	
	if (data.optionsConfig.columns != undefined && data.optionsConfig.columns[0] != undefined && data.optionsConfig.columns[0] != 0) {
		streetcarByLine.columns = data.optionsConfig.columns[0];
	} else {
		streetcarByLine.columns = 2; // default
	}
	
	if (data.optionsConfig.ping != undefined && data.optionsConfig.ping[0] != undefined) {
		streetcarByLine.ping = function() {		
			jQuery.ajax({
  			url: "../assets/img/ping.png",
  			cache: false
			});
			setTimeout("streetcarByLine.ping()",data.optionsConfig.ping[0]*1000);
		}
		// create a ping (to keep internet connections open) every specified number of seconds
		streetcarByLine.ping();
	}
	
	// add stylesheet

	if (data.optionsConfig.stylesheet != undefined && data.optionsConfig.stylesheet[0] != undefined) {
		var link = jQuery("<link>");
		link.attr({
			type: 'text/css',
		  rel: 'stylesheet',
		  href: data.optionsConfig.stylesheet[0]
		});
		jQuery("head").append( link ); 
		
	}
	
	if (data.optionsConfig.logo != undefined && data.optionsConfig.logo[0] != undefined) {
		var logo = '<img src="'+data.optionsConfig.logo[0]+'" style="height: 120px; width: auto">';
	} else {
		var logo = '';
	}
	

	
	var font_scale_factor = 1;
	if (data.optionsConfig['font-size-adjust'] != undefined && data.optionsConfig['font-size-adjust'][0] != undefined) {
		font_scale_factor = data.optionsConfig['font-size-adjust'][0]/100;
	}
	
	// set sizes
	var window_height = jQuery(window).height();
	var basic_text = Math.floor(font_scale_factor*window_height/30) + "px";
	var large_text = Math.floor(font_scale_factor*window_height/20) + "px";
	var padding    = Math.floor(font_scale_factor*window_height/100) + "px";
	var scroller_height = (Math.floor(font_scale_factor*window_height/30)+Math.floor(font_scale_factor*window_height/100)) + "px";
	
	// bigger fonts for wider displays
	if (jQuery(window).width()/jQuery(window).height() > 1.4) {
		window_height = jQuery(window).height();
		basic_text = Math.floor(font_scale_factor*window_height/22) + "px";
		large_text = Math.floor(font_scale_factor*window_height/14) + "px";
		padding    = Math.floor(font_scale_factor*window_height/100) + "px";
		scroller_height = (Math.floor(font_scale_factor*window_height/22)+Math.floor(font_scale_factor*window_height/100)) + "px";
	}
	

	jQuery("head").append(jQuery('<style>\
			#tb_bottom td { font-size: '+basic_text+';}\
			h1 { font-size: '+large_text+'; margin-bottom: '+padding+'; }\
			body { overflow: hidden }\
		</style>\
	'));
	
	// get the rights strings
	for (var agency in data.stopsConfig) {
		//streetcarByLine.standing_messages.push("<span>"+data.agencyCache.agencyData(agency).rights_notice+"</span>");
	}
	//streetcarByLine.standing_messages.push("<span>HH:MM = scheduled arrival, real-time estimate unavailable.</span>");
		
	// populate html
	
	var html = '\
<div id="tb_top">\
	';
	if ((logo != "") || (streetcarByLine.banner != "")) {
		html += '\
<table cellpadding="10"><tr valign="middle">\
		';
		if (logo != "") {
			html += '<td id="logo" align="center">'+logo+'</td>';
		}
		if (streetcarByLine.banner != "") {
			html+= '<td id="banner" width="100%" align="center"><h1>Transit Board&trade; for '+streetcarByLine.banner+'</h1></td>';
		} else {
			html+= '<td id="banner" width="100%" align="center">&nbsp;</td>';
		}
		html+= '<td><img width="390" height="120" src="../assets/images/streetcar_logo.jpg"/></td>';
		html += '\
</tr></table>\
		';
	}
	html += '</div>';
	html += '\
	</div>\
<div id="tb_middle">\
	<div id="arrivals_outer_wrapper">\
		<div id="arrivals_inner_wrapper">\
		</div>\
		<div id="arrivals_inner_wrapper2">\
		</div>\
	</div>\
		';
	if (streetcarByLine.car2go) {
		html += '\
	<div id="car2go">\
		<div id="car2go0" class="car2go"><table><tr valign="middle"><td class="image"><img src="../assets/images/car2go/car2go_vehicle.jpg" style="height: 69px"></td><td class="address"></td><td class="dist"></td></tr></table></div>\
		<div id="car2go1" class="car2go"><table><tr valign="middle"><td class="image"><img src="../assets/images/car2go/car2go_vehicle.jpg" style="height: 69px"></td><td class="address"></td><td class="dist"></td></tr></table></div>\
	</div>\
			';
		}
	html += '\
</div>\
<table id="tb_bottom"><tr><td id="tb_clock"></td><td id="tb_ticker"><div class="scroller"><div class="scrollingtext"></div></div></td></tr></table>\
	';
	
	jQuery('body').html(html);
		
	
 	
	var bottom_height = jQuery(window).height() - jQuery("#tb_bottom").offset().top;

	jQuery("body").css("padding-bottom",bottom_height+"px");

	setTimeout( function() {
		streetcarByLine.target_width = Math.floor(jQuery("#tb_middle").width()/streetcarByLine.columns);
		var actual_width = jQuery("div.trip").outerWidth(true);
			
		var destination_wrapper_width = jQuery("div.destination_wrapper").width() + streetcarByLine.target_width - actual_width;
	
		jQuery("head").append(jQuery('<style>\
				div.trip div.destination_wrapper { width: '+destination_wrapper_width+'px; }\
			</style>\
		'));
		
		// set up scroller
	
		var cell_width = jQuery("#tb_ticker").width();
		jQuery(".scroller").css("height",scroller_height);
		
		setTimeout(function(){
			// allow html to settle before calculating heights
				
			// set the height of the div
			streetcarByLine.max_available_height = jQuery("#tb_bottom").offset().top - jQuery("#tb_middle").offset().top - 20;
			jQuery("#tb_middle").css("height",streetcarByLine.max_available_height+"px").css("width","100%");
			
		},2000);
		
	},2000);
	
}

streetcarByLine.do_animation_step_js = function(animation_target,animation_step_time) {
	var current_top = parseInt(jQuery('#arrivals_outer_wrapper').css("top"));
	var target_top = current_top - streetcarByLine.animation_step;
	//alert("current top: "+current_top+", target: "+target_top);
	var last = false;
	if (target_top <= animation_target) {
		target_top = animation_target;
		last = true;
	}
	jQuery('#arrivals_outer_wrapper').animate({top: target_top},animation_step_time/2, "linear", function() {
		//jQuery("#logo").html(new Date() - animation_start);
		if (last) {
			jQuery('#arrivals_outer_wrapper').css("top","0");
			streetcarByLine.rotation_complete = true;
			//jQuery("#logo").html("last "+(new Date() - animation_start));
		} else {
			setTimeout(function() {
				streetcarByLine.do_animation_step(animation_target,animation_step_time);
			},animation_step_time*3);
			streetcarByLine.advanceMessage();
		}
	});
}

streetcarByLine.do_animation_step = function(animation_target,animation_step_time) {
	var current_top = parseInt(jQuery('#arrivals_outer_wrapper').css("top"));
	var target_top = current_top - streetcarByLine.animation_step;
	//alert("current top: "+current_top+", target: "+target_top);
	var last = false;
	if (target_top <= animation_target) {
		target_top = animation_target;
		last = true;
	}
	var duration = (animation_step_time/2)+"ms";
	jQuery('#arrivals_outer_wrapper').css({"transition-duration": duration, "-webkit-transition-duration": duration, "-moz-transition-duration": duration});
	jQuery('#arrivals_outer_wrapper').css("top", target_top);
	
	setTimeout(function() {
		if (last) {
			jQuery('#arrivals_outer_wrapper').css({"transition-duration": "0s", "-webkit-transition-duration": "0s", "-moz-transition-duration": "0s"});
			jQuery('#arrivals_outer_wrapper').css("top","0");
			streetcarByLine.rotation_complete = true;
		} else {
			setTimeout(function() {
				streetcarByLine.do_animation_step(animation_target,animation_step_time);
			},animation_step_time*3);
			streetcarByLine.advanceMessage();
		}
	},animation_step_time);
}

streetcarByLine.animate_display = function() {
	//check if we have any arrivals left, if not, mark class to insert background
	if (jQuery("div.sc_trip").length == 0) {
		jQuery("#tb_middle").addClass("tb_empty");
	} else {
		jQuery("#tb_middle").removeClass("tb_empty");
	}
	
	var animation_start = new Date();
	if (false && jQuery('#arrivals_inner_wrapper').height() > streetcarByLine.max_available_height) {
		if (streetcarByLine.rotation_complete) {
			streetcarByLine.rotation_complete = false;
			jQuery(".trip_wrapper").width(streetcarByLine.target_width);
			var animation_step_time = Math.floor((streetcarByLine.animation_factor*(streetcarByLine.displayInterval)/4)*streetcarByLine.animation_step/jQuery('#arrivals_inner_wrapper').height());
			var animation_target = -jQuery('#arrivals_inner_wrapper').height();
			jQuery('#arrivals_outer_wrapper').css("top","0px");

			setTimeout(function() {
				jQuery('#arrivals_inner_wrapper2').html(jQuery('#arrivals_inner_wrapper').html());
				streetcarByLine.do_animation_step(animation_target,animation_step_time);
			},2000); // initial two second delay in starting animation
		} else {
			//fell behind, so we don't animate stops
			if (streetcarByLine.animation_factor > 0.6) {
				streetcarByLine.animation_factor = streetcarByLine.animation_factor * 0.95; // speed things up a bit
			}
		}
	} else {
		// need to rotate message
		var message_interval = streetcarByLine.displayInterval/4;
		// 3 times
		streetcarByLine.advanceMessage();
		setTimeout(function() {
			streetcarByLine.advanceMessage();
			setTimeout(function() {
				streetcarByLine.advanceMessage();
			},message_interval);
		},message_interval);
	}
}

streetcarByLine.displayPage = function(data, callback) {
	
	if (data.displayCallCount == -1) {
		if (callback) {
			callback();
		}
		return;
	}
	
	if (streetcarByLine.car2go) {
		// update car2go
		var vehicles = streetcarByLine.cars.get_vehicles();
		jQuery.each(vehicles, function(index,value) {
			var dist = value[1];
			if (dist < 0.1) {
				dist = 0.1;
			}
			var address = value[0];
			address = address.replace("(","<br>(");
			jQuery("#car2go"+index+" td.address").html("<div>"+address+"</div>");
			jQuery("#car2go"+index+" td.dist").html(streetcarByLine.cars.format_distance(dist));
		});
	}
		
	jQuery('#arrivals_inner_wrapper').isotope(
		{
		  // options
		  animationEngine: 'best-available',
		  transformsEnabled: !streetcarByLine.isChumby,
		  itemSelector : 'div.trip_wrapper',
		  layoutMode: 'masonry',  
			getSortData : {
			  sortkey : function ( $elem ) {
			    return parseInt(jQuery($elem).attr('data-sortkey'));
			  }
			},
			sortBy : 'sortkey'
		}
	);
			
	// we finished paging sequence previously, need to build a new page state
	
	var by_trip = {};
	
	var filtered_queue = filter_queue(data.arrivalsQueue);
	
	for (var i = 0; i < filtered_queue.length; i++) {
		
		var trip_identifier = filtered_queue[i].stop_id+"_"+filtered_queue[i].headsign.replace(/[^a-zA-Z0-9]/g,"");
		
		if (filtered_queue[i].headsign.substr(0,3) == 'MAX') {
			filtered_queue[i].app_route_id = "MAX";
			filtered_queue[i].app_headsign_less_route = filtered_queue[i].headsign.replace(/^MAX /,"");
			filtered_queue[i].app_color = filtered_queue[i].app_headsign_less_route.replace(/ .*$/,"").toLowerCase();
		} else if (filtered_queue[i].route_id == "193") {
			filtered_queue[i].app_route_id = "NS";
			filtered_queue[i].app_headsign_less_route = filtered_queue[i].headsign;		
			filtered_queue[i].app_color = 'streetcar'
		} else {		
			var route_name = filtered_queue[i].route_data.route_short_name || filtered_queue[i].route_data.route_long_name;
			filtered_queue[i].app_route_id = route_name;
			filtered_queue[i].app_headsign_less_route = filtered_queue[i].headsign.replace(route_name,"");
			filtered_queue[i].app_color = filtered_queue[i].route_data.service_class;
		}
		
		// highlight terminus
		if (filtered_queue[i].app_headsign_less_route.match(/ to /i)) {
			filtered_queue[i].app_headsign_less_route = filtered_queue[i].app_headsign_less_route.replace(/ to /i," to <span class=\"terminus\">")+"</span>";
		}
		
		if (!by_trip[trip_identifier]) {
			by_trip[trip_identifier] = {};
			by_trip[trip_identifier].arrivals = [];
			by_trip[trip_identifier].stop_id = filtered_queue[i].stop_id;
			by_trip[trip_identifier].first_arrival_time = filtered_queue[i].arrivalTime;
			var service_class = filtered_queue[i].route_data.service_class;
			if (service_class > 4) {
				service_class = 5;
			}
			var direction_multiplier = 0;
			if (streetcarByLine.split_by_direction) {
				direction_multiplier = 100000;
			} else {
				direction_multiplier = 1;
			}
			by_trip[trip_identifier].sort_key = 10*filtered_queue[i].route_id + 10000*service_class + direction_multiplier*filtered_queue[i].route_data.direction_id;
		}
		by_trip[trip_identifier].arrivals.push(filtered_queue[i]);
	}
	

	
	function trArrCompareArrivalSets(a,b) {
		return +by_trip[a].sort_key - +by_trip[b].sort_key;
	}
	

	var trip_keys = [];
	for (var key in by_trip) {
		trip_keys.push(key);
	}
	
	var sorted_trip_keys = trip_keys.sort(trArrCompareArrivalSets);
	

	var trip_objects = {};
	var trip_inner_html = {};
	var trip_arrivals_html = {};
	for (var i = 0; i < sorted_trip_keys.length; i++) {
		var trip_key = sorted_trip_keys[i];
		var by_trip_html = "";
		by_trip_html += "<div class=\"trip_wrapper\" data-sortkey=\""+by_trip[trip_key].sort_key+"\"><div id=\""+trip_key+"\" class=\"sc_trip service_color_"+by_trip[trip_key].arrivals[0].app_color+" route_"+by_trip[trip_key].arrivals[0].route_id+" direction_"+by_trip[trip_key].arrivals[0].route_data.direction_id+"\" data-sortkey=\""+by_trip[trip_key].sort_key+"\">\n";
		var first_arrival = streetcarByLine.formatted_arrival_time(by_trip[trip_key].arrivals[0])
		var trip_arrival = "<div class=\"sc_trip_arrival_first\"><span style=\"font-size: 150%\">"+first_arrival.replace(" min","")+"</span> min</div>";
		if (trip_arrival.match(/:/)) {
			trip_arrival = "<div class=\"sc_trip_arrival_first\"><span style=\"font-size: 150%\">"+first_arrival+"</span></div>";
		}
		if (first_arrival == "Due") {
			trip_arrival = "<div class=\"sc_trip_arrival_first\"><span style=\"font-size: 150%\">Due</span></div>";
		}
		if (by_trip[trip_key].arrivals[1]) {
			trip_arrival += "<div class=\"sc_trip_arrival_second\">"+streetcarByLine.formatted_arrival_time(by_trip[trip_key].arrivals[1])+"</div>";
		} else {
			trip_arrival += "<div class=\"sc_trip_arrival_second\">&nbsp</div>";
		}
		var destination = by_trip[trip_key].arrivals[0].headsign;
		if (by_trip[trip_key].arrivals[0].route_id == '193') {
			destination = destination.replace("Streetcar To","NS Streetcar to");
		}
		destination = destination.replace("Portland Streetcar ","");
		var photo_src = "../assets/images/streetcar_"+by_trip[trip_key].arrivals[0].route_id+"_"+by_trip[trip_key].arrivals[0].route_data.direction_id+".jpg";
		var trip_inner = '<div class="sc_trip_destination">'+destination+'</div>';
		trip_inner += '<div class="sc_trip_arrival_row">';
		trip_inner += '<div class="sc_trip_arrival_time">'+trip_arrival+'</div>';
		trip_inner += '<div class="sc_trip_arrival_photo"><img src="'+photo_src+'" width="391" height="140"/></div>';	
		trip_inner += '</div>';
		trip_inner += '<div class="sc_trip_arrival_origin">Board at '+by_trip[trip_key].arrivals[0].stop_data.stop_name+'</div>';
		by_trip_html += trip_inner+"</div></div>";
		trip_objects[trip_key] = by_trip_html;
		trip_inner_html[trip_key] = trip_inner;
		trip_arrivals_html[trip_key] = trip_arrival;
	}			
	
	var insertion_queue = [];
	var removal_queue = [];
	

	
	function process_insertions() {
		if (insertion_queue.length > 0) {
			var obj = insertion_queue.shift();
			jQuery('#arrivals_inner_wrapper').isotope( 'insert', jQuery(obj) );
			process_insertions();
		} else {
			streetcarByLine.animate_display();
		}
	}
	
			//jQuery('#arrivals_inner_wrapper').isotope( 'reLayout', function() {
	
	function process_removals() {
		if (removal_queue.length > 0) {
			var id = removal_queue.shift();
			jQuery('#arrivals_inner_wrapper').isotope( 'remove', jQuery("#"+id).parent() );
			//jQuery("#"+id).parent().remove(); // for good measure, as Isotope seems to leave some elements around
			process_removals();
		} else {
			process_insertions();
		}
	}
	

	// see if we need to delete any elements
	jQuery("div.sc_trip").each(function(index,element){
		var id = jQuery(element).attr("id");
		if (trip_objects[id] == null) {
			removal_queue.push(id);
		}
	});
	
	// update or add items
	for(var id in trip_objects) {
		if (jQuery("#"+id).length > 0) {
			// update
			if (jQuery("div#"+id+" div.arrivals").html() != trip_arrivals_html[id]) {
				jQuery("div#"+id+" div.sc_trip_arrival_time").html(trip_arrivals_html[id]);
				//jQuery("div#"+id+" span.arrival").fadeOut(200, function() {
				//	jQuery("div#"+id+" div.arrivals").html(trip_arrivals_html[id]);
				//	jQuery("div#"+id+" span.arrival").fadeIn(200);
				//});
			}
		} else {
			// add it
			insertion_queue.push(trip_objects[id]);
		}
	}
	
	if (false && insertion_queue.length > 0) {
		console.log(new Date().toUTCString());
		console.log("insertions:");
		console.log(insertion_queue);
	}
		
	
	if (false && removal_queue.length > 0) {
		console.log(new Date().toUTCString());
		console.log("removals:");
		console.log(removal_queue);
	}
	
	process_removals();
	
	if (jQuery('#arrivals_inner_wrapper').children().length > 4) {
		jQuery('#arrivals_inner_wrapper .sc_trip_destination').each(function(){
			console.log(jQuery(this).text());
		});
	}
	
	streetcarByLine.connection_health = data.connectionHealth;
	
	// set time 
        // Don't just use new Date() because time zone may be set wrong
	var client_time = localTime();
    var client_time_formatted = client_time.toString('h:mmtt');
    
	client_time_formatted = client_time_formatted.replace(/^0:/,'12:');
	jQuery('#tb_clock').html(client_time_formatted);
	
}

function filter_queue(arrivalsQueue) {
		
	// filter out arrivals with headsign indicating NW 14th		
	
	var tmp_queue = [];
	// removes everything before now and greater than 24 hours from now
	for (var i = 0; i < arrivalsQueue.length; i++) {
		if (!arrivalsQueue[i].headsign.match(/14th/)) {
			tmp_queue.push(arrivalsQueue[i]);
		}
	}

	return tmp_queue;

}



				