// Important flags to keep in mind:
//  - CHECK WITH CATHERINE = for Catherine to verify as `ok`
//  - CHECK WITH JOHN = for John to verify as `ok`
//  - CHECK WITH NICK = for Nick to verify as `ok`
//  - TODO = for anyone to look at and see if they can start/tackle
//      the issue at hand.


// Client will be notified when event with given id is changed
// 	userId is user to be matched
// 	eventId is event to fill for the user
//  numGuests is the number of guests the guest creator wants to go with
Parse.Cloud.define('matchUser', function(req, res) {
	var userId = req.params.userId;
    // eventId that is given to us by client; eventId is created BY CLIENT NOT US
	var eventId = req.params.eventId;
  var numFriends = req.params.guests;
	var Event = Parse.Object.extend("Event"); // specify name of type you're querying for
	var query = new Parse.Query(Event); // makes a new query over Events
    // matchUser STUB; TO REMOVE!!!
	query.get(eventId).then(function(event) {
		res.success(event.get("restaurantName"));
	}, function(error) {
		res.error(error);
	});
    // Query for users based on their restaurant preferences,
    //  within the distance specified, with at least one
    //  shared conversation interest
    // EVENT CREATOR: Chinese, Vietnamese, Japanese
    // George: Chinese, American, Italian // FIND
    // Clooney: Chinese // FIND
    // Jack: Chinese, Greek // FIND
    // Jill: Japanese
    // Jane: Vietnamese, Korean
    // ...

    // Available Query Methods:
    // - containedIn
    // - contains
    // - containsAll
    // - equalTo

    // Get current user
    var userQuery = new Parse.Query(Parse.User);
    // Query for other users that match the event
    //  creator's cuisine preference list
    userQuery.get(userId).then(function(currUser) {
        // recursively creates a promise chain
        // TODO: We need to fix this '0' index. For loop?
        return usersForCuisines(currUser, numGuests, 0);
    }).then(function(data) { // consume promise chain and obtain the query data
        // TODO: The initial search returned NO MATCHES... in this case what should be done?
        //  Fill in the event as a no go? CHECK WITH NICK
        if (!_.isEmpty(data)) { // CHECK WITH NICK
            var users = data.users;
            var cuisine = data.cuisine;
            // TODO: What does this comment mean?
            // We can leverage this in order to NOT double search (i.e.
            //  Let's pass index instead of zero into our query function
            //  usersForCuisines, which means we want to start our query a
            //  certain number of cuisines in so as to not do double work).
            //  We should also check if index >= 'cuisines' array length
            var index = data.index;
        }
    });

    // TODO LIST:
    // 1) We need to notify the user that they've been invited // CHECK WITH NICK
    //      - the user will then RSVP
    // 2) We need to expand our search to look beyond just finding the first match
    //      - If all the people who like Chinese food can't go, we need to now
    //          query for people with Vietnamese food as their preference, etc.
    // 3) Yelp Related Search:
    //      - TODO: DISCRETIZE OUR BUDGET LIMITS (i.e. like Yelp: $ -> $$ -> $$$ -> $$$$)
    //      - We need to find a restaurant within our attendees' given max distance travel radius
    //      - Attendees' budget limits are respected (i.e. they aren't paying through the nose)
    //      - If number of potential attendees drops below numGuests, restart the search (i.e. step 2)
    // 4) If there are multiple people that fit the ticket, randomize the results
    // infty) FINAL STEP: We need to populate our eventId once everything is found
});

// Returns a PROMISE that contains the results of our query
//  This promise will then be consumed in the above query.get(...)...
function usersForCuisines(currUser, numFriends, indexIntoCuisines) { // TODO: Rename this function because this function is a "mega query" for user groups
    // get the current cuisine type we want to match against other users
    var cuisine = currUser.get('cuisines')[indexIntoCuisines];
    var friendsQuery = new Parse.Query(Parse.User);
    // Check if the users in our database are within the max
    //  travel radius the event creator is willing to travel
    friendsQuery.withinMiles('userLocation', currUser.get('userLocation'),
        currUser.get('maxTravelDistance'));
    // Check if the users within our database share any conversation
    //  preferences with the event creator (OR kind of logic)
    //  E.G.: CONTINUING THE EXAMPLE ABOVE
    //      CREATOR: Chess, Water polo, Bongo drums
    //      George: Water polo, polo, Ralph Lauren // FIND
    //      Clooney: Coding, Chess // FIND
    //      Jack: Bunnies, Jackrabbits, Jackelopes
    //      Jill: Bongo drums
    //      Jane: Chess, Bunnies
    //      ...
    friendsQuery.containedIn('conversationPreferences',
        currUser.get('conversationPreferences'));

    return friendsQuery.containedIn("cuisines", cuisine).find().then(function(results) {
        // TODO: if 2 friends, should we priortize ==, but then back off to 1?
        // TODO: define numOtherUsers
        if (results.length >= numFriends) return { // base case
            "users": results,
            "cuisine": cuisine,
            "index": index // Remember where our search stops
        };
        // TODO: We need to make sure we stop if index exceeds the length
        //  of our `user.get('cuisines')` array. CHECK BELOW CODE WITH NICK
        if (index + 1 == currUser.get('cuisines').length) return {}; // second base case
        return usersForCuisines(currUser, indexIntoCuisines + 1); // recursive case
    });
}

// Assumes that user id provided is in the pending portion of the
// 	event's pendingUsers (i.e. an array of user id's) field (i.e.
//  will not remove user from any other Event field, just pendingUsers)
Parse.Cloud.define('userRSVP', function(req, res) {
	var userId = req.params.userId;
	var eventId = req.params.eventId;
	var canGo = req.params.canGo;
	var Event = Parse.Object.extend("Event");
	var query = new Parse.Query(Event);
	query.get(eventId).then(function(event) {
        if (canGo) event.addUnique("goingUsers", userId);
		else event.addUnique("unavailableUsers", userId);
		event.remove("pendingUsers", userId);
		event.save(); // need to call after modifying any field of a Javascript object
		res.success(); // & every time you use an array specific modifier, you have to call it again
	}, function(error) {
		res.error(error);
	});

});


/* SAMPLE CODE */

// `Hello, World!` equivalent lol...
Parse.Cloud.define('hello', function(req, res) {
  res.success('Hi');
});


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
