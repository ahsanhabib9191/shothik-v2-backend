const Pusher = require("pusher");

const pusher = new Pusher({
    appId: "1755389",
    key: "1edcc67646cc23974d73",
    secret: "069f1e1dc8458e3b2bda",
    cluster: "ap4",
    useTLS: true
});

// trigger message
function sendMessage(channel, event, data){
    pusher.trigger(channel, event, {
        message: data
    });
}


function sendPusherToBanglaGrammer(message, channel,  conversationId){
    pusher.trigger(channel, String(conversationId), {
        message,
        conversationId
    }).then((res) => {
        console.log('sent');
    }
    ).catch((err) => {
        console.log('err to sent');
    });

}

function meetingKeyNoteStatus(browserId, data){
    pusher.trigger("keynote", `${browserId}`, {
        ...data
    });
}

module.exports = {
    sendMessage,
    meetingKeyNoteStatus,
    sendPusherToBanglaGrammer,
}