
Parse.Cloud.define('hello', function(req, res) {
  res.success('Hi');
});

// Client will be notified when event with given id is changed
// 	userId is user to be matched
// 	eventId is event to fill for the user
Parse.Cloud.define('matchUser', function(req, res) {
	var userId = req.params.userId;
	var eventId = req.params.eventId;
    var numGuests = req.params.guests; // the number of guests the event creator wants to go with
	var Event = Parse.Object.extend("Event"); // specify name of type you're querying for
	var query = new Parse.Query(Event); // makes a new query over Events
	query.get(eventId).then(function(event) {
		res.success(event.get("restaurantName"));
	}, function(error) {
		res.error(error);
	});
    // Query for users based on their restaurant preferences, 
    //  within the distance specified, with at least one
    //  shared conversation interest
    // User: Chinese, Vietnamese, Japanese
    // George: Chinese, American, Italian // find
    // Clooney: Chinese // find
    // Jack: Chinese, Greek // find
    // Jill: Japanese
    // Jane: Vietnamese, Korean

    // Available Query Methods: 
    // - containedIn
    // - contains
    // - containsAll
    // - equalTo

    // Get current user
    var userQuery = new Parse.Query(Parse.User);
    query.get(userId).then(function(user) {
        return usersForCuisines(user, 0);
    }).then(function(data) {
        var users = data.users;
        var cuisine = data.cuisine;
    });
});

// Returns a PROMISE that contains the results of our query
//  This promise will then be consumed in the above query.get(...)...
function usersForCuisines(user, index) {
    var cuisine = user.get('cuisines')[index];
    var query = new Parse.Query(Parse.User);
    //query.near('userLocation', user.get('userLocation'));
    query.withinMiles('userLocation', user.get('userLocation'), user.get('maxTravelDistance'));
    query.containedIn('conversationPreferences', user.get('conversationPreferences'));
    return query.containedIn(cuisine, "cuisines").find().then(function(results) {
        if (results.length >= numOtherUsers) return {
            "users": results,
            "cuisine": cuisine
        };
        return usersForCuisine(user, index + 1);
    });
}

// Assumes that user id provided is in the pending portion
// 	of the event's pendingUsers (i.e. an array of user id's) field
Parse.Cloud.define('userRSVP', function(req, res) {
	var userId = req.params.userId;
	var eventId = req.params.eventId;
	var canGo = req.params.canGo;
	var Event = Parse.Object.extend("Event");
	var query = new Parse.Query(Event);
	query.get(eventId).then(function(event) {
		event.addUnique("unavailableUsers", userId);
		event.remove("pendingUsers", userId);
		event.save(); // need to call after modifying any field of a Javascript object 
		res.success(); // & every time you use an array specific modifier, you have to call it again
	}, function(error) {
		res.error(error);
	});

});


/* SAMPLE CODE */


// Send a restaurant name, we will return all matching restaurants
Parse.Cloud.define('yelpFun', function(req, res) {
	Parse.Cloud.httpRequest({
		method: 'GET',
		url: "http://localhost:1337/yelp?term=" + req.params.term, // url of whatever server we are running on
	}).then(function(httpResponse) {
		res.success(httpResponse.text);
	}, function(httpResponse) {
		res.error("An error occurred: " + httpResponse.status);
	});
});



// Send a restaurant name, we will return all matching restaurants
Parse.Cloud.define('eventQuery', function(req, res) {
	var Event = Parse.Object.extend("Event"); // specify name of type you're querying for
	var query = new Parse.Query(Event); // makes a new query over Events

	var cuisine = req.params.cuisine; // Get parameters passed to this cloud function

	// Specify any constraints on the query
	query.equalTo("cuisine", cuisine);

	// Run the query using promises (query.find for all, query.first for one)
	query.find().then(function(response) {
		console.log(response);
		var newQuery = new Parse.Query(Event);
		return newQuery.find();

	}).then(function(response) {

		console.log(response);
		res.success(true);

	}, function(error) {
		res.error(error);
	});
});
