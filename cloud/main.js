
Parse.Cloud.define('hello', function(req, res) {
  res.success('Hi');
});

// Client will be notified when event with given id is changed
// 	userId is user to be matched
// 	eventId is event to fill for the user
Parse.Cloud.define('matchUser', function(req, res) {
	var userId = req.params.userId;
	var eventId = req.params.eventId;
	var Event = Parse.Object.extend("Event"); // specify name of type you're querying for
	var query = new Parse.Query(Event); // makes a new query over Events
	query.get(eventId).then(function(event) {
		res.success(event.get("restaurantName"));
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
