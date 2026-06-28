// src/state/defaultState.js

export const DEFAULT_STATE = {
  version: 1,

  settings: {
    meetingName: "Gateway Men’s Meeting",
    meetingDay: "Friday",
    meetingStartTime: "7:00 PM",
    meetingArriveTime: "6:45 PM",

    minConfirmed: 9,
    preferredConfirmed: 12,
    maxVolunteers: 14,

    mission:
      "Gateway to Service exists to help members show up for Friday Night service at Gateway, ensuring the responsibility of coordinating the list can be easily passed on to the next service member.",

    messages: {
      invite:
        "Good morning [Name], You’re invited to attend the Gateway Men’s Meeting this Friday evening at 7 PM. Please arrive at 6:45 PM.\n\nPlease reply to this text to let me know if you will or will not be attending.\n\nThank you for your willingness to serve and carry the message. God Bless 🙏🏾",

      followUp:
        "Good afternoon [Name],\nJust following up on the invite for this Friday’s Gateway Men’s Meeting.\n\nIf you’re able to attend, that would be great. If not, no worries at all — please let me know so we can make sure the spot goes to someone who is available.\n\nThank you for your service and for getting back to me. God Bless 🙏🏾",

      reminder:
        "Good afternoon,\nJust a reminder that the Gateway Men’s Meeting is tonight at 7 PM.\nSee you at 6:45 PM. Thank you for your service 🙏🏾",

      firstTime:
        "Good morning [Name],\nThank you for your willingness to volunteer for the Gateway Men’s Meeting this Friday evening. We truly appreciate your heart for service and helping carry the message.\n\nI just want to share a quick note about Gateway to Service. When we commit to attend, we’re committing not only to the group, but also to the patients who are counting on us to be there. Because of that, it’s important to only say yes if you’re confident you can attend as planned.\n\nIf you’re unsure about this Friday, it’s completely okay to let me know. We would rather give the opportunity to someone who knows they’re available than risk a last-minute cancellation.\n\nPlease reply to this text to let me know if you will or will not be attending. Either way, thank you again for your willingness to serve. God Bless 🙏🏾",

      gatewayEmployee:
        "Good afternoon [Name],\nHere is the volunteer list for the Gateway Men’s Meeting this Friday, [Date].\n\n[List]\n\nThank you.",

      gatewayApplicationRequest:
        "Hi [Name],\n\nGateway is now requiring all Friday Night Men’s Meeting volunteers to complete a volunteer application, background check, and drug test. You do not have to pay for anything.\n\nThis is a Gateway requirement so they know who is entering their facilities. If you do not want to go through this process, I completely understand.\n\nHowever, this is required in order to continue volunteering at the Friday Night Men’s AA Meeting.\n\nPlease send me your email address so I can forward it to Gateway HR. They will send you an email with the link to begin the process. Please also be on the lookout for emails from Gateway Foundation and Bloomerang.\n\nIf you have any questions, please let me know. Thank you for your service.",

      firstStepLeadRequest:
        "Hi [Name],\nWould you be willing to lead the 1st Step discussion at Gateway this Friday?\n\nPlease let me know either way. Thank you for your service 🙏🏾",

      checkIn:
        "Hi [Name],\nJust checking in with you. I noticed you have not been available recently, and I wanted to see if you would still like to stay on the Gateway volunteer list.\n\nNo pressure either way. Please let me know when you get a chance. Thank you.",
    },
  },

  volunteers: [
    // We'll add real volunteers in a later step.
    // For now, keep empty or add placeholders.
  ],

  weeks: [
    // We'll add weeks (Fridays) later.
  ],
};