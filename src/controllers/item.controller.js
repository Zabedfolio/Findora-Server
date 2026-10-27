
import Item from "../models/item.model.js";

// Create new lost/found item
export const createItem = async (req, res) => {
  try {
    const itemData = { ...req.body };

    // Support frontend owner object mapping
    if (req.body.owner && !req.body.postedBy) {
      itemData.postedBy = {
        userId: req.body.owner.id || req.body.owner._id || "",
        name: req.body.owner.name || "Anonymous",
        email: req.body.owner.email || "",
        image: req.body.owner.avatar || req.body.owner.image || "/default-avatar.png",
      };
    }

    const item = await Item.create(itemData);

    res.status(201).json({
      success: true,
      message: "Item report created successfully",
      data: item,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all items (with optional filters)
export const getAllItems = async (req, res) => {
  try {
    const { type, category, location, status, search, userId, email } = req.query;

    const filter = {};

    if (type) filter.type = type;
    if (category) filter.category = category;
    if (location) filter.location = { $regex: location, $options: "i" };
    if (status) filter.status = status;
    if (userId) filter["postedBy.userId"] = userId;
    if (email) filter["postedBy.email"] = email;

    if (search) {
      filter.$text = { $search: search };
    }

    const items = await Item.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: items.length,
      data: items,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get single item by ID
export const getItemById = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    res.status(200).json({
      success: true,
      data: item,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update item
export const updateItem = async (req, res) => {
  try {
    const item = await Item.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Item updated successfully",
      data: item,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete item
export const deleteItem = async (req, res) => {
  try {
    const item = await Item.findByIdAndDelete(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Item deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Mark item as resolved
export const markAsResolved = async (req, res) => {
  try {
    const item = await Item.findByIdAndUpdate(
      req.params.id,
      { status: "resolved" },
      { new: true }
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Item marked as resolved",
      data: item,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};