const { default: mongoose } = require("mongoose");
const Blog = require("../mongo/models/blog");
const BlogCategory = require("../mongo/models/blogCategory");
const BlogComments = require("../mongo/models/blogComments");
const Newsletter = require("../mongo/models/newsletter");

const postCategory = async (req, res) => {
  try {
    const isExist = await BlogCategory.findOne({ title: req.body.title });
    if (isExist) {
      return res
        .status(409)
        .send({ success: false, message: "Already exist this category" });
    }
    const data = await BlogCategory.create(req.body);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getCategory = async (req, res) => {
  try {
    const data = await BlogCategory.find({ isDeleted: false }).sort({
      createdAt: -1,
    });
    res.json({ success: false, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

//update category;
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await BlogCategory.updateOne(
      { _id: id },
      { $set: req.body },
      { new: true }
    );
    if (data.modifiedCount === 1) {
      res.json({ success: true, message: "Update successful" });
    } else {
      res.json({ success: false, message: "Unable to update" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

//delete category;
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await BlogCategory.updateOne(
      { _id: id },
      { $set: { isDeleted: true } }
    );
    if (data.deletedCount === 1) {
      res.json({ success: true, message: "Delete successful" });
    } else {
      res.json({ success: false, message: "Unable to delete" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

//create blog
const createBlog = async (req, res) => {
  try {
    const isExist = await Blog.findOne({ slag: req.body.slag });
    if (isExist) {
      return res.json({
        success: false,
        message: "Blog already exist with this slag",
      });
    }
    const data = await Blog.create(req.body);
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

//verify slag is exist or not
const verifySlag = async (req, res) => {
  try {
    const { slag } = req.params;
    const isExist = await Blog.findOne({ slag });
    if (isExist) {
      return res.json({ success: false, message: "Slag already exist" });
    }
    res.json({ success: true, isAvailable: true });
  } catch (error) {
    res.status(500).json({ success: false, isAvailable: false });
  }
};

//get all blogs
const getAllBlogs = async (req, res) => {
  try {
    let { limit = 50, page = 1, categoryId, search } = req.query;

    limit = parseInt(limit);
    page = parseInt(page);

    const skip = limit * (page - 1);

    const matchQuery = {};
    if (categoryId) {
      matchQuery.category = new mongoose.Types.ObjectId(categoryId);
    }
    if (search) {
      matchQuery.title = { $regex: search, $options: "i" };
    }

    const pipeline = [
      {
        $match: matchQuery, // Match the query conditions
      },
      {
        $lookup: {
          // Populate the 'category' field
          from: "blogcategories",
          localField: "category",
          foreignField: "_id",
          as: "category",
        },
      },
      {
        $unwind: {
          // Unwind 'category' field
          path: "$category",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          // Populate the 'author' field
          from: "users",
          localField: "author",
          foreignField: "_id",
          as: "author",
        },
      },
      {
        $unwind: {
          // Unwind 'author' field
          path: "$author",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          // Populate the 'editorContent' field
          from: "admins",
          localField: "editorContent",
          foreignField: "_id",
          as: "editorContent",
        },
      },
      {
        $unwind: {
          // Unwind 'editorContent' field
          path: "$editorContent",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          // Populate the 'comments' field
          from: "blogcomments",
          localField: "_id",
          foreignField: "blogId",
          as: "comments",
        },
      },
      {
        $addFields: {
          totalComments: { $size: { $ifNull: ["$comments", []] } },
        },
      },
      {
        $project: {
          comments: 0,
          "author.password": 0,
          "editorContent.password": 0,
        },
      },
      {
        $sort: {
          createdAt: -1, // Sort by createdAt field in descending order
        },
      },
      {
        $skip: skip, // Skip the specified number of documents
      },
      {
        $limit: limit, // Limit the number of returned documents
      },
    ];

    const data = await Blog.aggregate(pipeline);

    const total = await Blog.countDocuments(matchQuery);
    const totalPages = Math.ceil(total / limit);

    res.json({ success: true, data, totalPages });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// get blog by id
const getBlogById = async (req, res) => {
  try {
    const { slag } = req.params;

    // Fetch the blog by ID and populate category and author fields
    const blog = await Blog.findOne({ slag })
      .populate("category")
      .populate("author", "_id name email country role")
      .populate("editorContent", "_id name email avatar");

    if (!blog) {
      return res
        .status(404)
        .json({ success: false, message: "Blog not found" });
    }

    // Fetch and populate comments
    const comments = await BlogComments.find({ blogId: blog._id })
      .populate({
        path: "user",
        select: "_id name email role",
      })
      .populate({
        path: "replies.user",
        select: "_id name email role",
      })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        ...blog.toObject(),
        comments,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

//update blog
const updateBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await Blog.updateOne(
      { _id: id },
      { $set: req.body },
      { new: true }
    );
    if (data.modifiedCount === 1) {
      res.json({ success: true, message: "Update successful" });
    } else {
      res.json({ success: false, message: "Unable to update" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// remove blog
const deleteBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await Blog.deleteOne({ _id: id });
    if (data.deletedCount === 1) {
      res.json({ success: true, message: "Delete successful" });
    } else {
      res.json({ success: false, message: "Unable to delete" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// like blog
const likeBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.body.userId;

    // check if user already liked the blog if likedd then throww error
    const blog = await Blog.findById(id);
    const isLiked = blog.likes.includes(userId);
    const isDisliked = blog.dislikes.includes(userId);
    if (isLiked) {
      return res.json({
        success: false,
        message: "You already liked this blog",
      });
    }

    const data = await Blog.updateOne(
      { _id: id },
      { $push: { likes: userId } },
      { new: true }
    );
    if (data.modifiedCount === 1) {
      // update dislikes array
      if (isDisliked) {
        await Blog.updateOne(
          { _id: id },
          { $pull: { dislikes: userId } },
          { new: true }
        );
      }

      res.json({ success: true, message: "Like successful" });
    } else {
      res.json({ success: false, message: "Unable to like" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// dislike blog
const dislikeBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.body.userId;

    //check if user already disliked the blog if disliked then throww error
    const blog = await Blog.findById(id);
    const isDisliked = blog.dislikes.includes(userId);
    if (isDisliked) {
      return res.json({
        success: false,
        message: "You already disliked this blog",
      });
    }

    const data = await Blog.updateOne(
      { _id: id },
      { $push: { dislikes: userId } },
      { new: true }
    );
    if (data.modifiedCount === 1) {
      // check if user already liked the blog if likedd then remove from likes array
      const isLiked = blog.likes.includes(userId);
      if (isLiked) {
        await Blog.updateOne(
          { _id: id },
          { $pull: { likes: userId } },
          { new: true }
        );
      }
      res.json({ success: true, message: "Dislike successful" });
    } else {
      res.json({ success: false, message: "Unable to dislike" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

//post comment
const postComment = async (req, res) => {
  try {
    const { content } = req.body;

    if (!content) {
      throw { message: "Comment content is required" };
    }

    const data = await BlogComments.create(req.body);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
//edit comment
const editComment = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await BlogComments.updateOne(
      { _id: id },
      { $set: req.body },
      { new: true }
    );

    if (data.modifiedCount === 1) {
      res.json({ success: true, message: "Update successful" });
    } else {
      res.json({ success: false, message: "Unable to update" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

//delete comment
const deleteComment = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await BlogComments.deleteOne({ _id: id });
    if (data.deletedCount === 1) {
      res.json({ success: true, message: "Delete successful" });
    } else {
      res.json({ success: false, message: "Unable to delete" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// post comment reply
const postCommentReply = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await BlogComments.updateOne(
      { _id: id },
      { $push: { replies: req.body } },
      { new: true }
    );
    if (data.modifiedCount === 1) {
      res.json({
        success: true,
        message: "Reply successful",
      });
    } else {
      res.json({
        success: false,
        message: "Unable to reply",
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// update comment reply
const updateCommentReply = async (req, res) => {
  try {
    const { id } = req.params;
    const { replyId } = req.body;
    const data = await BlogComments.updateOne(
      { _id: id },
      { $set: { "replies.$[reply]": req.body } },
      { arrayFilters: [{ "reply._id": replyId }], new: true }
    );

    if (data.modifiedCount === 1) {
      res.json({
        success: true,
        message: "Reply updated",
      });
    } else {
      res.json({
        success: false,
        message: "Unable to update reply",
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// delete comment reply
const deleteCommentReply = async (req, res) => {
  try {
    const { id } = req.params;
    const { replyId } = req.body;
    const data = await BlogComments.updateOne(
      { _id: id },
      { $pull: { replies: { _id: replyId } } },
      { new: true }
    );
    if (data.modifiedCount === 1) {
      res.json({
        success: true,
        message: "Reply deleted",
      });
    } else {
      res.json({
        success: false,
        message: "Unable to delete reply",
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

//like a comment
const likeComment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.body.userId;

    // check if user already liked the blog if likedd then throww error
    const comment = await BlogComments.findById(id);
    const isLiked = comment.likes.includes(userId);
    const isDisliked = comment.dislikes.includes(userId);
    if (isLiked) {
      return res.json({
        success: false,
        message: "You already liked this blog",
      });
    }

    const data = await BlogComments.updateOne(
      { _id: id },
      { $push: { likes: userId } },
      { new: true }
    );
    if (data.modifiedCount === 1) {
      // check if user already disliked the blog if disliked then remove from dislikes array
      if (isDisliked) {
        await BlogComments.updateOne(
          { _id: id },
          { $pull: { dislikes: userId } },
          { new: true }
        );
      }
      res.json({ success: true, message: "Like successful" });
    } else {
      res.json({ success: false, message: "Unable to like" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// dislike comment
const dislikedComment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.body.userId;

    //check if user already disliked the blog if disliked then throww error
    const comment = await BlogComments.findById(id);
    const isDisliked = comment.dislikes.includes(userId);
    if (isDisliked) {
      return res.json({
        success: false,
        message: "You already disliked this blog",
      });
    }

    const data = await BlogComments.updateOne(
      { _id: id },
      { $push: { dislikes: userId } },
      { new: true }
    );
    if (data.modifiedCount === 1) {
      // check if user already liked the blog if likedd then remove from likes array
      const isLiked = comment.likes.includes(userId);
      if (isLiked) {
        await BlogComments.updateOne(
          { _id: id },
          { $pull: { likes: userId } },
          { new: true }
        );
      }

      res.json({ success: true, message: "Dislike successful" });
    } else {
      res.json({ success: false, message: "Unable to dislike" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const addEmainForNewsletter = async (req, res) => {
  try {
    const { email } = req.body;
    const isExist = await Newsletter.findOne({ email });
    if (isExist) {
      return res
        .status(409)
        .json({ success: false, message: "Email already subscribed" });
    }
    const data = new Newsletter({ email });
    await data.save();
    res.json({ success: true, message: "Email added to newsletter" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
const getLatestBlogsForSiteMap = async (req, res) => {
  try {
    const blogs = await Blog.find({ }).sort({ _id: -1 }).select("slag updatedAt").limit(200);

    res
      .status(200)
      .json({ 
        success: true, 
        message: "Blog list", 
        blogs 
      });
  } catch (error) {
    console.log(error)
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  postCategory,
  deleteCategory,
  getCategory,
  updateCategory,
  createBlog,
  getAllBlogs,
  getBlogById,
  updateBlog,
  deleteBlog,
  likeBlog,
  dislikeBlog,
  postComment,
  editComment,
  deleteComment,
  postCommentReply,
  updateCommentReply,
  deleteCommentReply,
  likeComment,
  dislikedComment,
  verifySlag,
  addEmainForNewsletter,
  getLatestBlogsForSiteMap
};
