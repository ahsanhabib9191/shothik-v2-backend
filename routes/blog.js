const express = require("express");
const {
  postCategory,
  getCategory,
  updateCategory,
  deleteCategory,
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
  dislikedComment,
  likeComment,
  verifySlag,
  addEmainForNewsletter,
  getLatestBlogsForSiteMap,
} = require("../controllers/blog");
// const { verifyAuth } = require("../middleware/auth");

const { verifyAuth } = require('@ridz-shothikai/shothik-auth-service/src/middleware');
const router = express.Router();

// get latest blogs slugs and udpated At data
router.get("/sitemap-latest-blogs", getLatestBlogsForSiteMap);


// blog category routes
router.post("/category/create", postCategory);
router.get("/category/all", getCategory);
router.put("/category/edit/:id", updateCategory);
router.delete("/category/remove/:id", deleteCategory);

// blog routes
router.post("/create", verifyAuth, createBlog);
router.get("/all", getAllBlogs);
router.get("/:slag", getBlogById);
router.put("/edit/:id", verifyAuth, updateBlog);
router.delete("/remove/:id", verifyAuth, deleteBlog);
router.get("/verify-slag/:slag", verifyAuth, verifySlag);
// like and dislike;
router.patch("/like/:id", likeBlog);
router.patch("/dislike/:id", dislikeBlog);

// comment routes
router.post("/comment", postComment);
router.put("/comment/edit/:id", editComment);
router.delete("/comment/remove/:id", deleteComment);
// comment reply routes
router.post("/comment/reply/:id", postCommentReply);
router.put("/comment/reply/edit/:id", updateCommentReply);
router.delete("/comment/reply/remove/:id", deleteCommentReply);
//like dislike comment
router.patch("/comment/like/:id", likeComment);
router.patch("/comment/dislike/:id", dislikedComment);

//newsletter
router.post("/newsletter", addEmainForNewsletter);


module.exports = router;
