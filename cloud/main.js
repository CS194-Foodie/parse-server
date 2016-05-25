// Important flags to keep in mind:
//  - CHECK WITH CATHERINE = for Catherine to verify as `ok`
//  - CHECK WITH JOHN = for John to verify as `ok`
//  - CHECK WITH NICK = for Nick to verify as `ok`
//  - TODO = for anyone to look at and see if they can start/tackle
//      the issue at hand.

// Returns a PROMISE that contains the results of our query
//  This promise will then be consumed in the above query.get(...)...
function findFriendsAndRestaurant(currUser, numFriends, indexIntoCuisines) {
    console.log("Finding friends and restaurant2 ...")
    // get the current cuisine type we want to match against other users
    var cuisine = currUser.get('foodPreferences')[indexIntoCuisines];
    console.log('\t Food Pref: ' + cuisine)
    var friendsQuery = new Parse.Query(Parse.User);
    console.log('\t Location check? ')
    // friendsQuery.withinMiles('userLocation', currUser.get('userLocation'),
    //     currUser.get('maxTravelDistance'));
    console.log('\t Convo Pref? ')
    // friendsQuery.containedIn('conversationPreferences',
    //     currUser.get('conversationPreferences'));
    return friendsQuery.containedIn("foodPreferences", [cuisine]).find().then(function(friendsFound) {
        console.log("banana")
        // // TODO: if 2 friends, should we priortize ==, but then back off to 1?
        // // TODO: define numOtherUsers
        if (friendsFound.length >= numFriends) {
          console.log("Found user :D")
          return { // base case
              "users": friendsFound,
              "cuisine": cuisine,
              "index": indexIntoCuisines // Remember where our search stops
          };
        }
        console.log('beees')
        if (index + 1 == currUser.get('foodPreferences').length) return {}; // second base case
        return findFriendsAndRestaurant(currUser, indexIntoCuisines + 1); // recursive case
    }).then(function(eventParty) {
      console.log('ZING')
    }, function(error) {
      console.log(error)
    })
    // .then(function(eventParty) {
    //   // TODO: Assume a restaurant is always found. If not, we do more recursion
    //   return queryYelpForRestaurant(results)
    // })
}

// eventId that is given to us by client; eventId is created BY CLIENT NOT US
Parse.Cloud.define('matchUser', function(req, res) {
	var userId = req.params.userId;
	var eventId = req.params.eventId;
  var numFriends = req.params.guests;
	var Event = Parse.Object.extend("Event"); // specify name of type you're querying for
	var eventQuery = new Parse.Query(Event); // makes a new query over Events

  console.log('Matching user ' + userId + ' with ' + numFriends + ' friend.');
  // Get current user
  var userQuery = new Parse.Query(Parse.User);
  // Query for other users that match the event
  //  creator's cuisine preference list
  userQuery.get(userId).then(function(currUser) {
    console.log('\t Curr user found ' + currUser)
    // TODO: We need to fix this '0' index. For loop?
    return findFriendsAndRestaurant(currUser, numFriends, 0);
    //  eventQuery.get(eventId).then(function(event) {
    //   // Set restaurant
    //   event.addUnique("restraurantName", userId);
    //   event.addUnique("restraurantAddress", userId);
    //   event.save();
    // }
  }).then(function(match) { // consume promise chain and obtain the query data
      // TODO: The initial search returned NO MATCHES... in this case what should be done?
      //  Fill in the event as a no go? CHECK WITH NICK
      
      // if (!_.isEmpty(match)) { // CHECK WITH NICK
      //     var users = data.users;
      //     var cuisine = data.cuisine;
      //     var index = data.index;
      //     console.log("NOOOOO")
      // } else {
      //   console.log("found")
      // }
      res.success();
  }, function(error) {
		res.error(error);
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

/* Returns a JSON (TODO ?) a restaurant according to:
* - Shared cuisine interest
* - Budget (acc'g to the member with the lowest upperbound)
* - Location (acc'g to circle area that best fits the intersection of all member's radii)
*/
// function queryYelpForRestaurant(term) {
//   return Parse.Cloud.httpRequest({
//     method: 'GET',
//     url: getServerURL() + "/yelp?term=" + term, // url of whatever server we are running on
//   }).then(function(httpResponse) {
//     return httpResponse.text;
//   });
// }


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
    if (canGo) {
      event.addUnique("goingUsers", userId);
    }	else {
      event.addUnique("unavailableUsers", userId);
    }
		event.remove("pendingUsers", userId);
		event.save(); // need to call after modifying any field of a Javascript object
		res.success(); // & every time you use an array specific modifier, you have to call it again
	}, function(error) {
		res.error(error);
	});
});

// Send a restaurant name, we will return all matching restaurants
Parse.Cloud.define('yelpFun', function(req, res) {
	Parse.Cloud.httpRequest({
		method: 'GET',
		url: getServerURL() + "/yelp?term=" + req.params.term, // url of whatever server we are running on
	}).then(function(httpResponse) {
		res.success(httpResponse.text);
	}, function(httpResponse) {
		res.error("An error occurred: " + httpResponse.status);
	});
});

// matchUser STUB; TO REMOVE!!!
// query.get(eventId).then(function(event) {
// res.success(event.get("restaurantName"));
// }, function(error) {
// res.error(error);
// });


/* SAMPLE CODE */

// `Hello, World!` equivalent lol...
Parse.Cloud.define('hello', function(req, res) {
  res.success('Hi');
});


/* Returns the string containing the url of the server we are currently running on
 * (could be prod, staging, local, etc.).  Use this instead of hardcoding a URL
 * when making a request to avoid hitting the wrong server.
 *
 * For example, when running locally this returns http://localhost:1337 (default port)
 */
function getServerURL() {
    // Parse.serverURL has the /parse at the end, which we need to remove
    return Parse.serverURL.replace("/parse", "");
}

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
