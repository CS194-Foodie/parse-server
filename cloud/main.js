// Important flags to keep in mind:
//  - CHECK WITH CATHERINE = for Catherine to verify as `ok`
//  - CHECK WITH JOHN = for John to verify as `ok`
//  - CHECK WITH NICK = for Nick to verify as `ok`
//  - TODO = for anyone to look at and see if they can start/tackle
//      the issue at hand.
var _ = require('../node_modules/underscore/underscore.js')
// Returns a PROMISE that contains the results of our query
//  This promise will then be consumed in the above query.get(...)...
function findFriendsAndRestaurant(currUser, numFriendsRequested, indexIntoCuisines) {
  console.log("\t Finding friends and restaurant ...")

  var friendsQuery = new Parse.Query(Parse.User);

  // Exclude the currentUser from the search
  friendsQuery.notEqualTo('objectId', currUser.id)

  // get the current cuisine type we want to match against other users
  var cuisine = currUser.get('foodPreferences')[indexIntoCuisines];
  console.log('\t\t  Food Pref: ' + cuisine)

  console.log('\t\t  Location check? ')
  // friendsQuery.withinMiles('userLocation', currUser.get('userLocation'),
  //     currUser.get('maxTravelDistance') + MAX_TRAVEL_DISTANCE_MI);
  console.log('\t\t  Convo Pref? ')
  // friendsQuery.containedIn('conversationPreferences',
  //     currUser.get('conversationPreferences'));
  friendsQuery.containedIn("foodPreferences", [cuisine])

  return friendsQuery.find().then(function(friendsFound) {
      cuisine = currUser.get('foodPreferences')[indexIntoCuisines];
      console.log("\t\t  Recursive call #" + indexIntoCuisines)
      if (friendsFound.length >= numFriendsRequested) {
        //
        console.log("\t\t Found user :D")
        console.log(friendsFound)
        return { // base case
            "users": friendsFound,
            "cuisine": cuisine,
            "dist": 40000,
            "location": currUser.get('userLocatingString'),
            "lat": currUser.get('userLocation').latitude,
            "long": currUser.get('userLocation').longitude,
            // restuarant: ___
            // restaurantAddress: ____
            // linkToRestaurant: ___
            "index": indexIntoCuisines // Remember where our search stops
        };
      }
      console.log('\t\t Recursing more ... ')
      if (indexIntoCuisines + 1 == currUser.get('foodPreferences').length) {
        console.log("\t\t Nothing found");
        return {}; // second base case
      }
      return findFriendsAndRestaurant(currUser, numFriendsRequested, indexIntoCuisines + 1); // recursive case
  }).then(function(eventParty) {
    // TODO: Assume a restaurant is always found. If not, we do more recursion
    console.log("\n\nYelping ... ");
    return queryYelpForRestaurant(eventParty);
  }, function(error) {
    console.log(error);
  })
}

//https://api.yelp.com/v2/search?term=food&location=San+Francisco

function queryYelpForRestaurant(eventParty) {
  return Parse.Cloud.httpRequest({
    method: 'GET',
    url: getServerURL() + "/yelp?category_filter=" + eventParty.cuisine +
                              "&radius_filter=" + eventParty.dist +
                              "&cll=" + eventParty.lat + "," + eventParty.long +// url of whatever server we are running on
                              "&location=" + eventParty.location
  }).then(function(httpResponse) {
    console.log(httpResponse);
    return httpResponse;
  });
}

function inviteUsers(userIds, event, numFriends) {
  // Add users to pending or invited
  _.each(userIds, function(userId){
    if (numFriends > 0) {
      event.addUnique('invitedUsers', userId);
      // Use the userId and the event to send a
      //  push notification to the invited user
    } else {
      event.addUnique('pendingUsers', userId);
    }
    numFriends = numFriends - 1;
  });
  event.save();
}

// eventId that is given to us by client; eventId is created BY CLIENT NOT US
Parse.Cloud.define('matchUser', function(req, res) {
  var userId = req.params.userId;
  var eventId = req.params.eventId;
  var numFriends = req.params.guests;
  var eventQuery = new Parse.Query(Parse.Object.extend("Event")); // makes a new query over Events

  console.log('Matching user ' + userId + ' with ' + numFriends + ' friend.');
  // Get current user
  var userQuery = new Parse.Query(Parse.User);
  // Query for users that match the event creator's cuisine preference list
  userQuery.get(userId).then(function(currUser) {
    console.log('\t Curr user found ' + currUser)
    return findFriendsAndRestaurant(currUser, numFriends, 0);
  }).then(function(match) { // consume promise chain and obtain the query data
    return eventQuery.get(eventId).then(function(event) {
      if (!_.isEmpty(match)) {
          console.log('Match found!')
          var users = match.users;
          var cuisine = match.cuisine;
          var index = match.index;

          event.set('cuisineIndex', index); // keep track of our index
          event.addUnique("numGuests", numFriends); // Keep track of the number of guests within the event
          // CATHERINE CODE FOR FINDING RESTAURANT HERE:

          // Add restaurant to event (Yelp Query)

          // JOHN ADDING IN CODE HERE:

          // At this point, we know that the users match according to distance,
          //  food, and conversation preferences. We also have a restaurant.
          //  We now need to invite the users (should be conducted asynchronously)

          // inviteUsers(users, event, numFriends); // This should return a promise...

          //  eventQuery.get(eventId).then(function(event) {
          //   // Set restaurant
          //   event.addUnique("restraurantName", userId);
          //   event.addUnique("restraurantAddress", userId);
          //   event.save();
          // }

      } else {
        console.log('No match found');
        return event.destroy();
      }
    });
  }).then(function() {
    console.log('Finished matching user')
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


// Assumes that user id provided is in the invited portion of the
//  event's invitedUsers (i.e. an array of user id's) field (i.e.
//  will not remove user from any other Event field, just invitedUsers)
Parse.Cloud.define('userRSVP', function(req, res) {
  var userId = req.params.userId;
  var eventId = req.params.eventId;
  var canGo = req.params.canGo;
  var Event = Parse.Object.extend("Event");
  var query = new Parse.Query(Event);
  query.get(eventId).then(function(event) {
    var numGuests = event.get('numGuests');
    if (canGo) {
      event.addUnique("goingUsers", userId);
    } else {
      event.addUnique("unavailableUsers", userId);
    }
    event.remove("invitedUsers", userId);
    // Check if the list of pending users is below
    //  the number of users that we want for the event
    if (event.get('goingUsers').length == numGuests) {
      // Signal that we're done and the event is good to go
      event.set('isComplete', true);
      event.save();
      res.success();
    } else if (event.get('pendingUsers').length < numGuests) {
      // REQUERY! need to clear out the old information in
      //  our event's arrays
      res.success();
    }
    // Send invite to the next pending user // CHECK WITH NICK
    var nextInvitee = _.first(event.get('pendingUsers'));
    event.remove('pendingUsers', nextInvitee);
    event.addUnique('invitedUsers', nextInvitee);
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
