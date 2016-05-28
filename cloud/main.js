
Parse.Cloud.define('test', function(req, res) {
  res.success('Hi');
});


/* CLOUD FUNCTION: matchUser
--------------------------------
Handles finding people to eat with the given user.  Attempts to fill in the
event object created by this user.  Request must contain the following parameters:

    sessionToken - the session token of the user making the request
    eventId - the objectId of the event object created by this user.  This is the
                object that will be updated when event details are confirmed.  The
                user making this request should be listening for changes on this object
                to know when the event has been confirmed or denied (aka deleted).
    guests - the number of guests the requesting user would like for this event

Does not respond with any data.
---------------------------------
*/
Parse.Cloud.define('matchUser', function(req, res) {
    var sessionToken = req.params.sessionToken;
    var eventId = req.params.eventId;
    var Event = Parse.Object.extend("Event"); // specify name of type you're querying for
    var query = new Parse.Query(Event); // makes a new query over Events
    query.get(eventId).then(function(event) {
        res.success(event);
    }, function(error) {
        res.error(error);
    });
});


/* CLOUD FUNCTION: userRSVP
-----------------------
Handles a user's response to whether or not they can go to an event
they were invited to.  Request must contain the following parameters:

    sessionToken - the session token of the user making the request
    eventId - the objectId of the event the user is responding to
    canGo - true/false whether or not the user can go to the event

Does not send any data back in the response.
-----------------------
*/
Parse.Cloud.define('userRSVP', function(req, res) {
    var canGo = req.params.canGo;
    
    // Sign in on behalf of the current user
    Parse.User.become(req.params.sessionToken).then(function(currUser) {
      var Event = Parse.Object.extend("Event");
      var query = new Parse.Query(Event);
      return query.get(req.params.eventId);
    }).then(function(event) {
        event.addUnique("unavailableUsers", userId);
        event.remove("pendingUsers", userId);

        // need to call .save() after modifying fields of a Javascript object
        // plus EVERY time you use an array specific modifier
        return event.save();
      }).then(function() {
          res.success();
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
