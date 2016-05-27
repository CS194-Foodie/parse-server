/* CLOUD FUNCTION: getUserStatus
 * --------------------------------
 * Request params:
 * 		userId - the user ID for the user to return the status for
 *
 * Response format:
 *		"status" field - either "FREE", "ATTENDING", "ORGANIZING", or "WAITING"
 *		"eventId" field (for all but "FREE") - eventID of the event the
 *					the user is going to or waiting on
 *
 * Returns the availability status for a given user.  Does this
 * by checking if the user is currently connected (i.e. has created,
 * or is a part of) to any existing event objects.  Returns JSON
 * containing info about this user.
 */
Parse.Cloud.define("getUserStatus", function(req, res) {
	Parse.Cloud.useMasterKey();

	// Get the given user
	var user = null;
	var query = new Parse.Query(Parse.User);
	query.equalTo("objectId", req.params.userId);
	query.first().then(function(foundUser) {
		user = foundUser;

		// First query for events created by this user
		var ownEventQuery = new Parse.Query(Parse.Object.extend("Event"));
		ownEventQuery.equalTo("creator", user);
		return ownEventQuery.first();
	}).then(function(event) {

		if (event != undefined && event.get("isFinalized")) {
			
			// If this user has created an event, and it is scheduled...
			res.success({
				"status": "ORGANIZING",
				"eventId": event.id
			});

		} else if (event != undefined) {

			// If this user has created an event, but it's still being planned...
			res.success({
				"status": "WAITING",
				"eventId": event.id
			});

		} else {
			
			// Check if this user is attending any events
			var attendingEventQuery = new Parse.Query(Parse.Object.extend("Event"));
			attendingEventQuery.equalTo("isFinalized", true);
			attendingEventQuery.equalTo("goingUsers", user);
			return attendingEventQuery.first();
		}

	}).then(function(attendingEvent) {

		// If the user is attending an event
		if (attendingEvent != undefined) {
			res.success({
				"status": "ATTENDING",
				"eventId": attendingEvent.id
			});

		// The user has no current commitments
		} else {
			res.success({
				"status": "FREE"
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