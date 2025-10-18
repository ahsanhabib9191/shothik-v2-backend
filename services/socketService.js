const { getIO } = require("../config/socket");

const sendMessage = (event, data) => {
    const io = getIO();
    io.emit(event, { message: data });
};

const sendMessageToRoom = async (meetingId, event, message, status) => {
    const io = getIO();
    console.log(`Socket message emit: meetingId=${meetingId}, event=${event}, status=${status}, message=${message}`);
    const roomId = meetingId.toString();
    const sockets = await io.in(roomId).allSockets();
    console.log(`Emitting to room ${roomId} with ${sockets.size} clients`);
    io.to(roomId).emit(event, {status, message });
    // io.emit(event, { message });
};

module.exports = { sendMessage, sendMessageToRoom };