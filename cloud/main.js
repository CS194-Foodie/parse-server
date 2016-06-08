require('./userStatus.js');

var _ = require('../node_modules/underscore/underscore.js')
// Returns a PROMISE that contains the results of our query
//  This promise will then be consumed in the above query.get(...)...
function findFriendsAndRestaurant(currUser, numFriendsRequested, 
  indexIntoCuisines, indexIntoRestaurant, unavailable) {
  console.log('currUser: ' + currUser);
  console.log('foodPreferences: ' + currUser.get('foodPreferences'));
  if (indexIntoCuisines == currUser.get('foodPreferences').length) {
    console.log("\t\tBase case hit. No more cuisines to recurse.");
    return Parse.Promise.as(); // second base case
  }
  console.log("\t Finding friends and restaurant ...")

  var friendsQuery = new Parse.Query(Parse.User);

  // Exclude the currentUser from the search
  friendsQuery.notEqualTo('objectId', currUser.id)

  // get the current cuisine type we want to match against other users
  var cuisine = currUser.get('foodPreferences')[indexIntoCuisines];
  console.log(unavailable);
  console.log('adding constraint that users cannot come from: ' + getUserIds(unavailable));
  friendsQuery.notContainedIn('objectId', getUserIds(unavailable));
  console.log('got past limiting the users in unavailable...');
  friendsQuery.containedIn('foodPreferences', [cuisine]);
  console.log('\t\t  Food Pref: ' + cuisine);

  console.log('\t\t  Convo Pref? ');
  friendsQuery.containedIn('conversationPreferences',
      currUser.get('conversationPreferences'));

  return friendsQuery.find().then(function(friendsFound) {
      cuisine = currUser.get('foodPreferences')[indexIntoCuisines].toLowerCase();
      console.log("\t\t  Recursive call #" + indexIntoCuisines)
      if (friendsFound.length >= numFriendsRequested) {
        console.log("\t\t Found users to eat with :D");
        console.log(friendsFound);
        console.log(friendsFound[0].get('userLocation'));
        var eventParty =  {
            "users": friendsFound,
            "numGuests": numFriendsRequested,
            "cuisine": cuisine,
            "dist": currUser.get('maxTravelDistance'),
            "location": currUser.get('userLocationString'),
            "lat": currUser.get('userLocation').latitude,
            "long": currUser.get('userLocation').longitude,
            "cuisines": currUser.get('foodPreferences'),
            "index": indexIntoCuisines // Remember where our search stops
        };
        console.log("\t\t Event party created: ", eventParty, '\n');
        console.log("\n\nYelping ... ");
        return queryYelpForRestaurants(eventParty).then(function(restaurantData) {
          console.log('\tqueryYelpForRestaurant');
          if(!_.isEmpty(restaurantData)) {
            return queryYelpBusinessInfoOfRestaurants(eventParty, restaurantData, indexIntoRestaurant).then(function(singleRestaurantResult) {
              if (singleRestaurantResult != undefined) {
                console.log("\tRestaurant Found" + singleRestaurantResult + " " + indexIntoCuisines);
                return singleRestaurantResult;
              } else {
                console.log("No users match the restaurants cuisine X. Recursing to next cuisine.")
                return findFriendsAndRestaurant(currUser, numFriendsRequested, indexIntoCuisines + 1, 0, unavailable);
              }
            });
          } else {
            console.log("No restaurants found! Recursing to next cuisine");
            return findFriendsAndRestaurant(currUser, numFriendsRequested, indexIntoCuisines + 1, 0, unavailable);
          }
        });
      }
      console.log('\t\t Recursing more ... ')
      return findFriendsAndRestaurant(currUser, numFriendsRequested, indexIntoCuisines + 1, 0, unavailable); // recursive case
  }, function(error) {
    console.log(error);
  });
}


function getUserIds(unavailable) {
  var result = [];
  _.each(unavailable, function(user) {
    result.push(user.id);
  });
  return result;
}


function extractRestaurantData(businesses) {
  var result = [];
  _.each(businesses, function(business) {
    var data = {
      "id" : business.id,
      "name" : business.name,
      "address" : business.location.address,
      "rating" : business.rating,
      "lat" : business.location.coordinate.latitude,
      "lon" : business.location.coordinate.longitude,
      "display_address": business.location.display_address
    };
    result.push(data);
  });
  return result;
}

function queryYelpBusinessWrapper(eventParty, restaurantData, index) {
  if (index == restaurantData.length) {
    console.log('\t\t\tNo matching restaurant found...');
    return Parse.Promise.as();
  }
  console.log("\t Recursion for queryYelpBusinessWrapper")
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
          eventParty.restaurantIndex = index;
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

function queryYelpBusinessInfoOfRestaurants(eventParty, restaurantData, indexIntoRestaurant) {
  console.log("\tqueryYelpBusinessInfoOfRestaurants");
  return queryYelpBusinessWrapper(eventParty, restaurantData, indexIntoRestaurant);
}

function milesToMeters(miles) {
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
    return extractRestaurantData(httpResponse.data.businesses);
  });
}

function inviteUsers(users, eventId) {
  console.log("Inviting " + users);
  // return Parse.Promise.as(); // TODO: Remove
  var pushQuery = new Parse.Query(Parse.Installation);
  pushQuery.containedIn("user", users);

  // Silent push to devices (no banner)
  return Parse.Push.send({
    where: pushQuery,
    data: {
      "content-available": 1,
      FoodieNotificationType: "RSVP",
      eventId: eventId
    }
  }, { useMasterKey: true });
}

// Sends banner push to given users that event has been cancelled. 
function notifyEventCancelled(users) {
  return notifyUsersWithMessage(users, "Unfortunately, we couldn't plan your event.");
}


// Sends banner push to given users that event has been planned.
function notifyEventSuccess(users) {
  return notifyUsersWithMessage(users, "Let's eat!  Your event was successfully planned.");
}


// Sends banner push to given users with given message as banner alert.
// Also increments app badge count on iOS.
function notifyUsersWithMessage(users, message) {
  var usernames = users.map(function(user) { return user.get("name"); });
  console.log("Notifying: " + message + " - " + JSON.stringify(usernames));
  // return Parse.Promise.as(); // TODO: remove
  var pushQuery = new Parse.Query(Parse.Installation);
  pushQuery.containedIn("user", users);

  // Banner push notification
  return Parse.Push.send({
    where: pushQuery,
    data: {
      alert: message,
      badge: "Increment",
      FoodieNotificationType: "Message"
    }
  }, { useMasterKey: true });
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

  console.log('Matching user with token ' + sessionToken + ' with ' +
    numFriends + ' friend.');

  // Sign in as the current user (after this you can get the requesting user object at
  // any time by calling Parse.User.current()).
  Parse.User.become(sessionToken).then(function(currUser) {
    // Query for users that match the event creator's cuisine preference list
    console.log('\t Curr user found ' + currUser)
    return findFriendsAndRestaurant(currUser, numFriends, 0, 0, []);
  }).then(function(match) {
    return updateEvent(match, eventId, numFriends)
  }).then(function() {
    console.log('Finished matching user')
    res.success();
  }, function(error) {
    res.error(error);
  });
});

function updateEvent(match, eventId, numFriends) { // consume promise chain and obtain the query data
    // makes a new query over Events
  var eventQuery = new Parse.Query(Parse.Object.extend("Event"));
  console.log("\t\t\tMATCH" + match);
  return eventQuery.get(eventId).then(function(event) {
    if (match != undefined) {
        console.log('Match found!');
        console.log(match);

        event.set("pendingUsers", match.pendingUsers);
        event.set("invitedUsers", match.invitedUsers);
        event.set("cuisine", match.cuisine);
        event.set("cuisines", match.cuisines);
        event.set("restaurantDataArray", match.restaurantData)
        event.set("restaurantIndex", match.restaurantIndex);
        event.set("restaurantInfo", match.restaurantData[match.restaurantIndex]);
        event.set("cuisineIndex", match.index); // keep track of our index
        event.set("numGuests", numFriends); // Keep track of the number of guests within the event
        event.set("goingUsers", []);

        return event.save().then(function () {
          return inviteUsers(match.invitedUsers, eventId);
        });

    } else {
      console.log('No match found');
      return event.destroy().then(function() {
        return notifyEventCancelled([Parse.User.current()]);
      });
    }
  });
}

/* Only callable by the event owner, cancels the event and notifies
 * everyone else going that it has been cancelled.
 */
Parse.Cloud.define('cancelEvent', function(req, res) {
  var sessionToken = req.params.sessionToken;
  var eventId = req.params.eventId;

  console.log("Cancelling event " + eventId);

  Parse.User.become(sessionToken).then(function() {

      // Get the event to delete
      var Event = Parse.Object.extend("Event");
      var query = new Parse.Query(Event);
      return query.get(eventId);

  }).then(function(event) {

      // Delete the event, and fetch everyone besides owner going
      var goingUsers = event.get("goingUsers");
      return event.destroy().then(function() {
        console.log("Destroyed event object.");
        return fetchAllAsync(goingUsers);
      });
  }).then(function(users) {
    // Send a push that the event was cancelled
    console.log("Fetched going users, sending push...");
    return notifyEventCancelled(users);
  }).then(function() {
    console.log("Push successful!");
    res.success();
  }, function(error) {
    res.error(error);
  });
});


function fetchAllAsync(objects) {
  var promise = new Parse.Promise();
  Parse.Object.fetchAll(objects, {
    success: function(list) {
      promise.resolve(list);
    },
    error: function(error) {
      promise.reject(error);
    }
  });

  return promise;
}

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
  console.log('retrieved parameters');
  Parse.User.become(sessionToken).then(function() {

    var Event = Parse.Object.extend("Event");
    var query = new Parse.Query(Event);
    return query.get(eventId);

  }).then(function(event) {
    console.log('just entered the meat of the method...');
    var user = Parse.User.current();
    console.log('user: ' + user);
    var numGuests = event.get('numGuests');
    console.log('numGuests: ' + numGuests);
    console.log(event.get('unavailableUsers'));
    if (canGo) {
      console.log(user + " can go");
      event.addUnique("goingUsers", user);
    } else {
      console.log(user + " can't go");
      event.addUnique("unavailableUsers", user);
    }
    event.remove("invitedUsers", user);
    // Check if the list of pending users is below
    //  the number of users that we want for the event
    if (event.get('goingUsers').length == numGuests) {
      // Signal that we're done and the event is good to go
      console.log('Completed scheduling our event');
      event.set('isComplete', true);
      return event.save().then(function() {
        var everyone = event.get('goingUsers');
        everyone.push(event.get('creator'));
        return notifyEventSuccess(everyone);
      });
    } else if (event.get('invitedUsers').length == 0) { // Everyone invited so far has responded...
      if (event.get('pendingUsers').length == 0) { // Additionally, if pendingUsers is empty, we need to requery
        console.log('REQUERYing!!!');
        return event.save().then(function() {
          return requery(event, eventId);
        });
      } else {
        // Send invite to the next pending user // CHECK WITH NICK
        var numToInvite = numGuests - event.get('goingUsers');
        console.log("inviting " + numToInvite + " other users");
        var inviteeList = [];
        var pendingUserList = event.get('pendingUsers');
        if (event.get('pendingUsers').length >= numToInvite) {
          console.log('there are people to invite');
          for (var i = 0; i < numToInvite; i++) {
            console.log('iterating...');
            var nextInvitee = pendingUserList.shift();
            console.log('nextInvitee: ' + nextInvitee);
            if (nextInvitee != undefined) {
              console.log('blah');
              event.remove('pendingUsers', nextInvitee);
              console.log('blee');
              event.addUnique('invitedUsers', nextInvitee);
            }
            inviteeList.push(nextInvitee);
          }
          console.log(inviteeList);
          return event.save().then(function() {
            return inviteUsers(inviteeList, eventId);
          });
        } else {
          console.log('NO BODY LEFT LOL');
          return event.save().then(function() {
            return requery(event, eventId);
          });
        }
      }
    } else {
      return event.save();
    }
  }).then(function() {
    res.success();
  }, function(error) {
    console.log("ERROR!: " + error);
    res.error(error);
  });
});


function requery(event, eventId) {
  var numFriendsRequested = event.get('numGuests');
  var cuisineIndex = event.get('cuisineIndex');
  var restaurantIndex = event.get('restaurantIndex');
  // We've exhausted all the restaurants of a cuisine. Time to do another cuisine!
  if (restaurantIndex == event.get('restaurantDataArray').length) {
    cuisineIndex += 1;
  }
  // Otherwise, keep the current cuisine (other users exist), but change the restaurant 
  var userQuery = new Parse.Query(Parse.User);
  console.log('requerying...');
  return event.get('creator').fetch().then(function(fetchedCreator) {//Parse.Object.fetchAllIfNeeded([event.get('creator')]);
    console.log('requery call to findFriendsAndRestaurant...' + fetchedCreator);
    return findFriendsAndRestaurant(fetchedCreator, numFriendsRequested, 
      cuisineIndex, restaurantIndex + 1, event.get('unavailableUsers'));
  }).then(function(match) {
    console.log('requery call to updateEvent...');
    return updateEvent(match, eventId, numFriendsRequested);
  });
}


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

/* SAMPLE CODE */

// `Hello, World!` equivalent lol...
Parse.Cloud.define('hello', function(req, res) {
  res.success('Hi');
});

Parse.Cloud.define('sendPush', function(req, res) {
  var pushQuery = new Parse.Query(Parse.Installation);

  // Banner push notification
  Parse.Push.send({
    where: pushQuery,
    data: {
      alert: "Hello world!",
      badge: "Increment"
    }
  }, { useMasterKey: true }).then(function() {
    res.success("Sent.");
  }, function(error) {
    res.error("Error: " + JSON.stringify(error));
  });
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
