const { default: mongoose } = require("mongoose");
const { Folder } = require("../mongo/models/Folder");
const { MeetingFolder } = require("../mongo/models/MeetingFolder");
const { findById } = require("../mongo/models/Report");
const { MeetingModel } = require("../mongo/models/meetingMinute");
const ApiFeatures = require("../lib/ApiFeatures");

// Create a new folder
module.exports.createFolder = async (req, res) => {
    const { name } = req.body;
    const owner = req.id;
    try {
        const folder = new Folder({ name, owner });
        await folder.save();
        res.status(201).json({success:true, message: 'Create success', data: folder});
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// Update a new folder
module.exports.updateFolder = async (req, res) => {
    const { name } = req.body;
    const folderId = new mongoose.Types.ObjectId(req.params.id);
    try {
        const folder = await findById(folderId);
        if(!folder){
            return res.status(404).json({success: false, message: 'Folder not found'})
        }

        folder.name = name;
        const data = await folder.save();

        res.status(201).json({success:true, message: 'Update success', data: data});
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// Delete folde folder
module.exports.deleteFolder = async (req, res) => {
    const folderId = new mongoose.Types.ObjectId(req.params.id)
    try {
        // Find and delete the folder
        const folder = await Folder.findByIdAndDelete(folderId);
        
        if (!folder) {
            return res.status(404).json({ error: 'Folder not found' });
        }

        // Delete all meetings associated with this folder
        await MeetingModel.deleteMany({ 'folder.folderId': folderId });

        res.status(200).json({ message: 'Folder and associated meetings deleted successfully' });
    }catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// Get all folders for a user
module.exports.getFolders = async (req, res) => {
    const owner = req.id;
    try {
        const { keyword } = req.query;
        let perPage;

        if (req.query && typeof req.query.limit === 'string') {
            perPage = parseInt(req.query.limit, 10);
        }

        // Construct the search criteria
        const searchCriteria = { owner };
        if (keyword) {
            searchCriteria.name = keyword;
        }
       

        const count = await Folder.countDocuments(searchCriteria);

        const apiFeature = new ApiFeatures(
            Folder.find(searchCriteria).select('-__v').sort({ createdAt: -1 }),
            req.query,
        )
        .search()
        .filter();

        if (perPage !== undefined) {
            apiFeature.pagination(perPage);
        }

        const result = await apiFeature.query;
        const limit = result.length;

        const currentPage = req.query.page
            ? parseInt(req.query.page, 10)
            : 1;

        let totalPages;

        if (perPage !== undefined) {
            totalPages = Math.ceil(count / perPage);
        }

        let nextPage;
        let nextUrl;

        if (perPage !== undefined && currentPage < totalPages) {
            nextPage = currentPage + 1;
            nextUrl = `${req.originalUrl.split('?')[0]}?limit=${perPage}&page=${nextPage}`;
            if (keyword) {
                nextUrl += `&keyword=${keyword}`;
            }
        }

        res.status(200).json({
            success: true,
            data: result || [],
            total: count,
            perPage,
            limit,
            nextPage,
            nextUrl,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// Add a meeting to a folder
module.exports.addMeetingToFolder = async (req, res) => {
    const { folderId, meetingId } = req.body;
    try {
        const meetingFolder = new MeetingFolder({ folder: folderId, meeting: meetingId });
        await meetingFolder.save();
        res.status(201).json({success:true, data:meetingFolder});
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// Add multiple meeting to a folder
module.exports.addMeetingsToFolder = async (req, res) => {
    const { folderId, meetingIds } = req.body;
    
    try {
        // Ensure meetingIds is always an array
        const meetingsToAdd = Array.isArray(meetingIds) ? meetingIds : [meetingIds];

        // Create an array of MeetingFolder objects
        const meetingFolders = meetingsToAdd.map(meetingId => ({
            folder: folderId,
            meeting: meetingId
        }));

        // Insert many documents at once
        const result = await MeetingFolder.insertMany(meetingFolders);

        res.status(201).json({
            success: true,
            message: `${result.length} meeting(s) added to folder successfully`,
            data: result
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// move meeting to another folder
module.exports.moveMeetingToAnotherFolder = async (req, res) => {
    const { meetingId, folderId } = req.body;

    try {
        // Find the existing MeetingFolder and update with new folder ID
        const updatedMeetingFolder = await MeetingFolder.findOneAndUpdate(
            { meeting: meetingId },
            { folder: folderId },
            { new: true }
        );

        if (!updatedMeetingFolder) {
            return res.status(404).json({ error: 'Meeting not found in any folder' });
        }

        res.status(200).json({ success: true, data: updatedMeetingFolder });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// move multiple meeting to another folder
module.exports.moveMeetingsToAnotherFolder = async (req, res) => {
    const { meetingIds, folderId } = req.body;

    try {
        // Ensure meetingIds is always an array
        const meetingsToMove = Array.isArray(meetingIds) ? meetingIds : [meetingIds];

        // Update multiple MeetingFolder documents
        const updateResult = await MeetingFolder.updateMany(
            { meeting: { $in: meetingsToMove } },
            { folder: folderId }
        );

        if (updateResult.matchedCount === 0) {
            return res.status(404).json({ error: 'No meetings found in any folder' });
        }

        res.status(200).json({
            success: true,
            message: `${updateResult.modifiedCount} meeting(s) moved successfully`,
            matchedCount: updateResult.matchedCount,
            modifiedCount: updateResult.modifiedCount
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// Get all meetings in a folder
exports.getMeetingsInFolder = async (req, res) => {

    const folderId = req.params.id;
    
    try {
        const { keyword, limit = 10, page = 1 } = req.query;
        const perPage = parseInt(limit, 10);
        const currentPage = parseInt(page, 10);

        // Fetch the folder
        const folder = await Folder.findById(folderId).lean();
        if (!folder) {
            return res.status(404).json({ success: false, message: "Folder not found" });
        }

        // Construct the search criteria
        const searchCriteria = { folder: folderId };
        if (keyword) {
            searchCriteria['meeting.title'] = { $regex: keyword, $options: 'i' };
        }

        const count = await MeetingFolder.countDocuments(searchCriteria);

        const apiFeature = new ApiFeatures(
            MeetingFolder.find(searchCriteria)
                .select('-__v')
                .sort({ createdAt: -1 })
                .populate({
                    path: 'meeting',
                    select: '-transcribeData',
                    populate: {
                        path: 'author',
                        select: '_id name email image'
                    }
                }),
            req.query
        )
        .search()
        .filter()
        .pagination(perPage);

        const result = await apiFeature.query;

        const meetings = result.map(item => ({
            _id: item.meeting._id,
            author: item.meeting.author,
            title: item.meeting.title,
            type: item.meeting.type,
            media: item.meeting.media,
            duration: item.meeting.duration,
            participants: item.meeting.participants,
            notes: item.meeting.notes,
            keyNotes: item.meeting.keyNotes,
            visibility: item.meeting.visibility,
            createdAt: item.meeting.createdAt,
            updatedAt: item.meeting.updatedAt
        }));

        const totalPages = Math.ceil(count / perPage);
        const nextPage = currentPage < totalPages ? currentPage + 1 : null;
        const nextUrl = nextPage ? `${req.originalUrl.split('?')[0]}?limit=${perPage}&page=${nextPage}${keyword ? `&keyword=${keyword}` : ''}` : null;

        res.status(200).json({
            success: true,
            folder: {
                _id: folder._id,
                name: folder.name,
                owner: folder.owner,
                createdAt: folder.createdAt,
                updatedAt: folder.updatedAt,
                __v: folder.__v
            },
            data: meetings,
            total: count,
            perPage,
            limit: meetings.length,
            nextPage,
            nextUrl,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};