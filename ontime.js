//++++++++++++++
// MAP FUNCTIONS
//++++++++++++++

let token = 'pk.eyJ1IjoiY3R1ZGVsIiwiYSI6ImNsd2hkMWl4djA3cTAya29hYmFtZjcxajIifQ.2Ugfx9Y20dpgJgMaFyn5kw';
let marker, circle, zoomed, routingControl;

/* Initialize map */
let map = L.map('map').setView([43.618881, -116.215019], 13);
let markers = {}; // Declare markers object

/* Resets map interface */
let resetMap = () => {
    if (routingControl) { // remove any routes on the map
        map.removeControl(routingControl);
    }

    if (!map.hasLayer(markers['start'])) { // handles markers['start'] exists, but not on the map
        markers['start'].addTo(map);
    }

    if (!map.hasLayer(markers['end'])) { // handles markers['end'] exists, but not on the map
        markers['end'].addTo(map);
    }

}

/* Finds an address based on latitude and longtitude */
let reverseGeocode = async (lat, lng) => {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;

    return await fetch(url)
        .then(async response => await response.json())
        .then(async data => {
            const address = data.display_name;
            return address.split(',')[1]; // Use only the first part of the display name as the relative name
        })
        .catch(error => {
            console.error('Error fetching reverse geocoding data:', error);
            return null;
        });
}

/* Locates the user's current position if successfully found */
let success = async (pos) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const accuracy = pos.coords.accuracy;

    // Create a marker
    marker = L.marker([lat, lng]).addTo(map);
    circle = L.circle([lat, lng], { radius: accuracy % 500 }).addTo(map);

    // Zoom to user's current location
    if (!zoomed) {
        // Move the map to the user's location
        zoomed = map.fitBounds(circle.getBounds());

        // Use reverse geocoding to get the address and set it as the default value of the start location text box
        const address = await reverseGeocode(lat, lng);
        if (address) {
            document.getElementById('start').value = address;
            markers['start'] = marker;
            markers['circle'] = circle;
        }
    }
}


/* 
 * Place a marker on the map given latitude and longtitude.
 * param 'type' is the key value used for storing a marker in the
 *      markers array
 */
let placeMarker = (type, lat, lng) => {

    // Remove old markers if any
    if (markers[type]) {
        map.removeLayer(markers[type]);
        delete markers[type];
    }

    // Create a marker
    markers[type] = L.marker([lat, lng]).addTo(map);

    // Set the view to include both markers
    map.fitBounds([
        markers['start'] ? markers['start'].getLatLng() : markers['end'].getLatLng(),
        markers['end'] ? markers['end'].getLatLng() : markers['start'].getLatLng()
    ]);
}


/* Removes a marker from the map */
let removeMarker = (type) => {
    if (markers[type]) {
        map.removeLayer(markers[type]);
        delete markers[type];
    }
}


/* Places a marker when a user clicks on the map */
let placeMarkerAtCursor = async (e) => {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    const startInput = document.getElementById('start');
    const endInput = document.getElementById('end');

    // Validate start address does not exist
    if (startInput.value.trim() === '') {
        placeMarker('start', lat, lng);

        const address = await reverseGeocode(lat, lng);
        if (address) {
            startInput.value = address;
            resetMap();
        }

    // Validate end target address does not exist
    } else {
        placeMarker('end', lat, lng);

        const address = await reverseGeocode(lat, lng);
        if (address) {
            endInput.value = address;
            resetMap();
        }

    } 
}


/* Retrieves the coordinates given an address */
let geocode = async (location) => {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${location}`;

    try { // attempt to fetch location
        const response = await fetch(url);
        const data = await response.json();

        if (data.length === 0) {
            console.error('No results found');
            return null;
        }

        return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }; // parse coords

    } catch (error) {
        console.error('Error fetching geocoding data:', error);
        return null;
    }
}


/* Place marker on a new location */
let getNewLocation = async (address, id) => {

    console.log('getNewLocation info: '+address+' '+id);

    if (address.trim() === '') {
        console.log('removing marker');
        removeMarker(id);
        resetMap();
        return;
    }
    
    const locationCoordinates = await geocode(address);
    
    if (!locationCoordinates) {
        showAlert('Invalid address, please try again.');
        return;
    }
    
    if (markers['circle']) {
        removeMarker('circle');
    }

    placeMarker(id, locationCoordinates.lat, locationCoordinates.lon);
}


/* Time estimation and routing logic between two points */
let planTravel = () => {
    resetMap(); // reset map if needed

    const start = markers['start'] ? markers['start'].getLatLng() : null;
    const end = markers['end'] ? markers['end'].getLatLng() : null;
    const arrivalTimeStr = document.getElementById('time').value.trim();

    if (!start || !end || !arrivalTimeStr) {
        showAlert('Please select a start, end location, and desired arrival time.');
        return;
    }

    const arrivalTime = parseTime(arrivalTimeStr);  // parse user time input
    if (!arrivalTime) {
        showAlert('Invalid arrival time format. Please use HH:mm[am/pm] format.');
        return;
    }

    // Create a route and add it to the map
    routingControl = L.Routing.control({
        waypoints: [
            L.latLng(start.lat, start.lng), // start coords
            L.latLng(end.lat, end.lng) // end coords
        ], 
        router: new L.Routing.mapbox(token, {
            profile: 'mapbox/driving'
        }),
        routeWhileDragging: true,
        show: false
    }).addTo(map);
    
    // Start calculations
    routingControl.on('routesfound', function(e) {
        const routes = e.routes;
        if (routes && routes.length > 0) {
            const route = routes[0];
            const travelTimeInSeconds = route.summary.totalTime;

            // Estimate time to leave for poignant arrival time
            const leaveTime = new Date(arrivalTime.getTime() - (travelTimeInSeconds * 1200));
            const leaveTimeFormatted = leaveTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
            const arrivalTimeFormatted = arrivalTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true});

            notification(`You should leave at ${leaveTimeFormatted} to arrive at ${arrivalTimeFormatted}`);
        }
    });

    /* Log the user's travel method to console */
    console.log("Route for: "+routingControl.options.router.options.profile);
}


/* Parse user input as 12hr formatted time */
let parseTime = (timeString) => {

    let hours = undefined;
    let mins = undefined;
    let period = undefined;


    /* Regular expression to match with timeString */

    // full time format
    let fullTime = /^(\d{1,2}):(\d{2})(\w{2})$/i; 
    let fullTimeMatch = timeString.match(fullTime);

    // hour and period format
    let hrAndPeriod = /^(\d{1,2})(\w{2})$/i;
    let hrAndPeriodMatch = timeString.match(hrAndPeriod);

    // no period formats
    let hrAndMin = /^(\d{1,2}):(\d{2})$/i; 
    let hrAndMinMatch = timeString.match(hrAndMin);

    let hr = /^(\d{1,2})$/i;
    let hrMatch = timeString.match(hr);

    if (!fullTimeMatch && !hrAndPeriodMatch && !hrAndMinMatch && !hrMatch) {
        return null;
    }

    if (fullTimeMatch) {
        hours = parseInt(fullTimeMatch[1], 10);
        mins = parseInt(fullTimeMatch[2], 10);
        period = fullTimeMatch[3].toUpperCase();

        console.log("hours: "+hours);
        console.log("mins: "+mins);
        console.log("period: "+period);
    } 

    if (hrAndPeriodMatch) {
        hours = parseInt(hrAndPeriodMatch[1], 10);
        period = hrAndPeriodMatch[2].toUpperCase();
    } 

    if (hrAndMinMatch) {
        hours = parseInt(hrAndMinMatch[1], 10);
        mins = parseInt(hrAndMinMatch[2], 10);
    } 

    if (hrMatch) {
        hours = parseInt(hrMatch[1], 10);
    } 

    return scanParsedTime(hours, mins, period); 

}

/* Scan and reformat the parsed user time input */
let scanParsedTime = (hours, mins, period) => {

    console.log('info from parseTime: '+hours+' '+mins+' '+period);

    if (!mins && !period) {

        hours = (hours === 12) ? 0 : hours;

        console.log('beginning first validation');

        if (validateTime(hours) === false) { 
            console.log('called first');
            return null;
        }

        return new Date(2000, 0, 1, hours, 0);

    } else if (!mins) {

        // check midnight or noon 
        hours = (period === 'AM' && hours === 12) ? 0 : hours;

        // handle 12hr format conversion
        hours = (period === 'PM' && hours !== 12) ? hours + 12 : hours;

        console.log('beginning second validation');

        if (validateTime(hours) === false) { 
            console.log('called second');
            return null;
        }

        return new Date(2000, 0, 1, hours, 0);

    }  else {

        // check midnight or noon 
        hours = (period === 'AM' && hours === 12) ? 0 : hours;

        // handle 12hr format conversion
        hours = (period === 'PM' && hours !== 12) ? hours + 12 : hours;

        console.log('beginning third validation');

        if (validateTime(hours, mins) === false) { // param 2 is minutes
            console.log('called third');
            return null;
        }

        return new Date(2000, 0, 1, hours, mins);

    }
}

/* Validate hours and minutes */
let validateTime = (hours, mins) => {

    if (!mins) {
        console.log("validating hours: "+hours+"...");
        console.log(hours >= 0 && hours < 24);

        return (hours >= 0 && hours < 24)

    } else { 
        console.log("validating hours: "+hours+"...");
        console.log("validating mins: "+mins+"...");
        console.log(hours >= 0 && hours < 24 && mins >= 0 && mins < 60);

        return (hours >= 0 && hours < 24 && mins >= 0 && mins < 60);
    }
}


/* Create visual message for user */
function showAlert(message) {
    var alertBox = document.getElementById('alert');
    var alertText = document.getElementById('alert-text');
    alertText.textContent = message;
    alertBox.style.display = 'block';
  
    // Hide the alert after 3 seconds
    setTimeout(function() {
      alertBox.style.display = 'none';
    }, 3000);
  }


function notification(message) {
    var notificationBox = document.getElementById('notification');
    var notificationText = document.getElementById('notification-text');
    notificationText.textContent = message;
    notificationBox.style.display = 'block';

    setTimeout(function() {
        notificationBox.style.display = 'none';
    }, 3000)
}
  


//+++++++++++++
// HTML ACTIONS
//+++++++++++++



/* Routing between two points if the enter key is pressed */
document.getElementById('start').addEventListener('keypress', async function(event) {
    if (event.key === 'Enter') {
        await getNewLocation(this.value,'start');
        planTravel();
    }
});

document.getElementById('end').addEventListener('keypress', async function(event) {
    if (event.key === 'Enter') {
        await getNewLocation(this.value, 'end');
        planTravel();
    }
});

document.getElementById('time').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        planTravel();
    }
});

/* Detect if a new location is entered and place marker */
document.getElementById('start').addEventListener('change', async function() {
    await getNewLocation(this.value, 'start');
});

document.getElementById('end').addEventListener('change', async function() {
    await getNewLocation(this.value, 'end');
});



//++++++++++++++
// PROGRAM CALLS
//++++++++++++++


/* Import a visual for our map */
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
		maxZoom: 19,
		attribution: '@MapBox &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
	}).addTo(map);

// Get user's current location and create new marker with it in the map's view
navigator.geolocation.getCurrentPosition(async function(pos) {
    var lat = pos.coords.latitude;
    var lng = pos.coords.longitude;
    map.setView([lat, lng], 13);

    // Call success function to place marker and set default start location to user's current location
    await success(pos);
}, function (err) {
    if (err === 1) {
        showAlert("Error: Location access was denied!");
    } else {
        showAlert("Error: cannot retrieve current location");
    }
});

/* Change location upon user clicks */
map.on('click', placeMarkerAtCursor);
