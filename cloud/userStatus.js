/* CLOUD FUNCTION: getUserStatus
 * --------------------------------
 * Request params:
 * 		sessionToken - the session token for the user to return the status for
 *
 * Response format:
 *		"status" field - either "FREE", "INVITED", "ATTENDING", or "WAITING"
 *		"event" field (for all but "FREE") - eevent object the
 *					the user is going to or waiting on
 *
 * Returns the availability status for a given user.  Does this
 * by checking if the user is currently connected (i.e. has created,
 * or is a part of) to any existing event objects.  Returns JSON
 * containing info about this user's status.
 * --------------------------------
 */
Parse.Cloud.define("getUserStatus", function(req, res) {

	// Log in as the given user
	Parse.User.become(req.params.sessionToken).then(function(user) {

		// Query for events that this user is a part of (either organizing,
		// attending, or invited to)
		var Event = Parse.Object.extend("Event");
		var ownEventQuery = new Parse.Query(Event);
		ownEventQuery.equalTo("creator", user);

		var invitedEventQuery = new Parse.Query(Event);
		invitedEventQuery.equalTo("invitedUsers", user);

		var goingEventQuery = new Parse.Query(Event);
		goingEventQuery.equalTo("goingUsers", user);

		return Parse.Query.or(ownEventQuery, invitedEventQuery, 
			goingEventQuery).first();
	}).then(function(event) {

		console.log("Found event - " + JSON.stringify(event));

		// If we're part of some event
		if (event != undefined) {

			// See if this user is in this event's list of invited users
			var invited = event.get("invitedUsers").find(function(invitedUser) {
				return invitedUser.id == Parse.User.current().id;
			}) != undefined;

			// If the event is finalized...
			if (event.get("isComplete")) {
				res.success({
					status: "ATTENDING",
					event: event
				});

			// If we're invited...
			} else if (invited) {
				res.success({
					status: "INVITED",
					event: event
				});

			// Otherwise, either as the creator or an attendee, we're waiting
			} else {
				res.success({
					status: "WAITING",
					event: event
				});
			}

		} else {
			res.success({
				status: "FREE"
			});
		}

	}, function(error) {
		res.error(error);
	});
});



/* FOR TESTING ONLY */
Parse.Cloud.define("update", function(req, res) {

	// Sign in as the given user
	Parse.User.become(req.params.sessionToken).then(function(user) {

		// First query for events created by this user
		var ownEventQuery = new Parse.Query(Parse.Object.extend("Event"));
		return ownEventQuery.find();
	}).then(function(events) {
		var promise = Parse.Promise.as();
		for (var i = 0; i < events.length; i++) {
			var event = events[i];
			event.set("creator", Parse.User.current());
			promise = promise.then(function() {
				return event.save();
			});
		}

		return promise;
	}).then(function() {

		res.success("Done");

	}, function(error) {
		res.error(error);
	});
});