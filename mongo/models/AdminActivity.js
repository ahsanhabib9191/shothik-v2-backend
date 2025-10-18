const { mongoose } = require('mongoose');

const adminActivitySchema = new mongoose.Schema({
  admin: {
    type: mongoose.Types.ObjectId,
    ref: 'Admin',
  },
  activity: {
    type: String,
    required: [true, 'Required Activity name'],
  },
}, {
  timestamps: true,
});

const AdminActivityModel = mongoose.model('AdminActivity', adminActivitySchema);

// Define the function to save activity logs
async function saveAdminActivity(admin, activity) {
  try {
    const saveActivity = new AdminActivityModel({
      admin,
      activity,
    });
    await saveActivity.save();

    console.log("Admin activity save successfully.");
  } catch (error) {
    console.error("Error saving admin activity:", error);
  }
}

module.exports = {
  AdminActivityModel,
  saveAdminActivity
};
