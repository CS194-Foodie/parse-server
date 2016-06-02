require('./userStatus.js');

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
  if (indexIntoCuisines == currUser.get('foodPreferences').length) {
    console.log("\t\tBase case hit. No more cuisines to recurse.");
    return {}; // second base case
  }
  console.log("\t Finding friends and restaurant ...")

  var friendsQuery = new Parse.Query(Parse.User);

  // Exclude the currentUser from the search
  friendsQuery.notEqualTo('objectId', currUser.id)

  // get the current cuisine type we want to match against other users
  var cuisine = currUser.get('foodPreferences')[indexIntoCuisines];
  console.log('\t\t  Food Pref: ' + cuisine)

  console.log('\t\t  Convo Pref? ')
  // friendsQuery.containedIn('conversationPreferences',
  //     currUser.get('conversationPreferences'));

  return friendsQuery.find().then(function(friendsFound) {
      cuisine = currUser.get('foodPreferences')[indexIntoCuisines];
      console.log("\t\t  Recursive call #" + indexIntoCuisines)
      if (friendsFound.length >= numFriendsRequested) {
        console.log("\t\t Found users to eat with :D");
        console.log(friendsFound);
        console.log(friendsFound[0].get('userLocation'));
        var eventParty =  {
            "users": friendsFound,
            "numGuests": numFriendsRequested,
            "cuisine": cuisine,
            "dist": currUser.get('maxTravelDistance'), // Used to be 40000 meters
            "location": currUser.get('userLocationString'),
            "lat": currUser.get('userLocation').latitude,
            "long": currUser.get('userLocation').longitude,
            "cuisines": currUser.get('foodPreferences'),
            "index": indexIntoCuisines // Remember where our search stops
        };
        console.log("\t\t Event party created: ", eventParty, '\n');
        //if (_.isEmpty(eventParty)) return {};
        console.log("\n\nYelping ... ");
        return queryYelpForRestaurants(eventParty).then(function(restaurantData) {
          console.log('\tqueryYelpForRestaurant');
          if(!_.isEmpty(restaurantData)) {
            return queryYelpBusinessInfoOfRestaurants(eventParty, restaurantData).then(function(singleRestaurantResult) {
              //console.log('\tfood preferences: ' + currUser.get('foodPreferences'));
              if (!_.isEmpty(singleRestaurantResult)) {
                console.log("\tRestaurant Found" + singleRestaurantResult + " " + indexIntoCuisines);
                return singleRestaurantResult;
              } else {
                console.log("No users match the restaurants cuisine X. Recursing to next cuisine.")
                return findFriendsAndRestaurant(currUser, numFriendsRequested, indexIntoCuisines + 1);
              }
            });
          } else {
            console.log("No restaurants found! Recursing to next cuisine");
            return findFriendsAndRestaurant(currUser, numFriendsRequested, indexIntoCuisines + 1);
          }
        });
      }
      console.log('\t\t Recursing more ... ')
      return findFriendsAndRestaurant(currUser, numFriendsRequested, indexIntoCuisines + 1); // recursive case
  }, function(error) {
    console.log(error);
  })
}

function extractRestaurantData(businesses) {
  var result = [];
  _.each(businesses, function(business) {
    var data = {
      "id" : business.id,
      "name" : business.name,
      "address" : business.location.address,
      "link" : business.url,
      "rating" : business.rating
    };
    result.push(data);
  });
  return result;
}

function queryYelpBusinessWrapper(eventParty, restaurantData, index) {
  if (index == restaurantData.length) {
    console.log('\t\t\tNo matching restaurant found...');
    return {};
  }
  console.log("\t Recursion for queryYelpBusinessWrapper")
  //console.log("\t\tRest Data" + restaurantData);
  console.log("\t\tRest Index: " + index);
  console.log('\t\tBiz id to look up: ' + restaurantData[index].id);
  return Parse.Cloud.httpRequest({
    method: 'GET',
    url: getServerURL() + "/businesses?business_id=" + restaurantData[index].id
  }).then(function(httpResponse) {
    console.log('\t\t\thttpResponse.data obtained!!!');
    var businessInfo = httpResponse.data;
    if (!_.isEmpty(businessInfo)) {
      console.log('\t\t\tbusinessInfo is not empty');
      var latitude = businessInfo.location.coordinate.latitude;
      var longitude = businessInfo.location.coordinate.longitude;
      console.log("\t\t\t\tlatitude: " + latitude);
      console.log("\t\t\t\tlongitude: " + longitude);
      var numGuests = eventParty.numGuests;
      var restaurantPoint = new Parse.GeoPoint(latitude, longitude);
      var users = eventParty.users;
      var currUserLocation = new Parse.GeoPoint(eventParty.lat, eventParty.long);
      var currUserMaxDist = eventParty.dist;
      var invited = [];
      var pending = [];
      console.log('\t\t\tSetup user and restaurant geopoints...');
      console.log('\t\t\tDist from rest to curr loc: '+ restaurantPoint.milesTo(currUserLocation));
      console.log('\t\t\tUser dist: ' + currUserMaxDist);
      if (restaurantPoint.milesTo(currUserLocation) <= currUserMaxDist) {
        console.log("\t\t\tRestaurant is WITHIN userloc range");
        console.log("\t\t\t" + users.length + " peers to check")
        _.each(users, function(user) {
          console.log('\t\t\t\tD rest to user:' + restaurantPoint.milesTo(user.get('userLocation')))
          console.log('\t\t\t\tUser dist: ' + user.get('maxTravelDistance'));
          if (restaurantPoint.milesTo(user.get('userLocation')) <= user.get('maxTravelDistance')) {
            console.log("\t\t\t\t\tRestaurant is WITHIN userloc range");
            if (invited.length < numGuests) {
              invited.push(user);
            } else {
              pending.push(user);
            }
          }
        });
        if (invited.length < numGuests) {
          console.log('\t\trecursing because we did not find enough people for this restaurant');
          return queryYelpBusinessWrapper(eventParty, restaurantData, index + 1);
        } else {
          console.log('\t\tAll guests match restaurant');
          eventParty.pendingUsers = pending;
          eventParty.invitedUsers = invited;
          eventParty.restaurantData = restaurantData;
          eventParty.restaruantIndex = index;
          return eventParty;
        }
      } else {
        // TODO: WILL NEVER GET HERE bc constraint is satisfied earlier
        console.log("\t\trecursing because the given restaurant is not within the creator's max distance");
        return queryYelpBusinessWrapper(eventParty, restaurantData, index + 1);
      }
    } else {
      console.log("\t\trecursing bc no business for that business id was found (yelp bug)");
      return queryYelpBusinessWrapper(eventParty, restaurantData, index + 1);
    }
  });
}

function queryYelpBusinessInfoOfRestaurants(eventParty, restaurantData) {
  console.log("\tqueryYelpBusinessInfoOfRestaurants");
  return queryYelpBusinessWrapper(eventParty, restaurantData, 0);
}

function milesToMeters(miles) {
  //return miles;
  console.log('\tMETERS!!!: ' + (miles * 1609.34));
  return (miles * 1609.34);
}

function queryYelpForRestaurants(eventParty) {
  return Parse.Cloud.httpRequest({
    method: 'GET',
    url: getServerURL() + "/yelp?category_filter=" + eventParty.cuisine +
                              "&radius_filter=" + milesToMeters(eventParty.dist) +
                              "&cll=" + eventParty.lat + "," + eventParty.long +// url of whatever server we are running on
                              "&location=" + eventParty.location
  }).then(function(httpResponse) {
    // console.log(httpResponse.data.businesses);
    return extractRestaurantData(httpResponse.data.businesses);
    // console.log(restaurantData);
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

/* CLOUD FUNCTION: matchUser
--------------------------------
Handles finding people to eat with the given user.  Attempts to fill in the
event object created by this user.  Request must contain the following parameters:

    sessionToken - the session token of the user making the request
    eventId - the objectId of the event object already created by this user.
                This is the object that this server will update when event
                details are confirmed.  The user making this request should be
                listening for changes on this object to know when the event
                has been confirmed or denied (aka deleted).
    guests - the number of guests the requesting user would like for this event

Does not respond with any data.
---------------------------------
*/
Parse.Cloud.define('matchUser', function(req, res) {
  var sessionToken = req.params.sessionToken;
  var eventId = req.params.eventId;
  var numFriends = req.params.guests;

  // makes a new query over Events
  var eventQuery = new Parse.Query(Parse.Object.extend("Event"));

  console.log('Matching user with token ' + sessionToken + ' with ' +
    numFriends + ' friend.');

  // Sign in as the current user (after this you can get the requesting user object at
  // any time by calling Parse.User.current()).
  Parse.User.become(sessionToken).then(function(currUser) {
    // Query for users that match the event creator's cuisine preference list
    console.log('\t Curr user found ' + currUser)
    return findFriendsAndRestaurant(currUser, numFriends, 0);
  }).then(function(match) { // consume promise chain and obtain the query data
    console.log("\t\t\tMATCH" + match);
    return eventQuery.get(eventId).then(function(event) {
      if (!_.isEmpty(match)) {
          console.log('Match found!');
          console.log(match);
          var users = match.users; // NOTE FROM NICK: These are user objects, not userIds
          var cuisine = match.cuisine;

          event.set("pendingUsers", match.pendingUsers)
          event.set("invitedUsers", match.invitedUsers)
          event.set("cuisines", match.cuisines)
          event.set("restaurantDataArray", match.restaurantData)
          event.set("restaruantIndex", match.restaruantIndex);
          event.set("cuisineIndex", match.index); // keep track of our index
          event.set("numGuests", numFriends); // Keep track of the number of guests within the event
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
          event.save();

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


/* CLOUD FUNCTION: userRSVP
-----------------------
Handles a user's response to whether or not they can go to an event
they were invited to.  Request must contain the following parameters:

    sessionToken - the session token of the user making the request.  The
                  requesting user MUST be only in the invitedUsers array
                  of the event below (aka they must be invited to respond)
    eventId - the objectId of the event the user is responding to
    canGo - true/false whether or not the user can go to the event

Does not send any data back in the response.
-----------------------
*/
Parse.Cloud.define('userRSVP', function(req, res) {
  var sessionToken = req.params.sessionToken;
  var eventId = req.params.eventId;
  var canGo = req.params.canGo;

  Parse.User.become(sessionToken).then(function() {

    var Event = Parse.Object.extend("Event");
    var query = new Parse.Query(Event);
    return query.get(eventId);

  }).then(function(event) {
    var userId = Parse.User.current().id;
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
