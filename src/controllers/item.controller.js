
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

// Get all items (with optional filters, pagination, and type counts)
export const getAllItems = async (req, res) => {
  try {
    const {
      type,
      category,
      location,
      status,
      search,
      q,
      userId,
      email,
      from,
      to,
      sort = "newest",
      limit = 9,
      page = 1,
    } = req.query;

    const filter = {};

    // 1. Type filter (ignore if 'all' or empty)
    if (type && type !== "all") {
      filter.type = type.toLowerCase();
    }

    // 2. Category filter
    if (category && category !== "All Categories") {
      filter.category = category;
    }

    // 3. Location filter
    if (location && location !== "All Locations") {
      filter.location = { $regex: location, $options: "i" };
    }

    // 4. Status filter
    if (status && status !== "all") {
      filter.status = status;
    }

    // 5. User filter
    if (userId) filter["postedBy.userId"] = userId;
    if (email) filter["postedBy.email"] = email.toLowerCase();

    // 6. Search query (search or q)
    const searchTerm = (search || q || "").trim();
    if (searchTerm) {
      filter.$or = [
        { title: { $regex: searchTerm, $options: "i" } },
        { description: { $regex: searchTerm, $options: "i" } },
        { location: { $regex: searchTerm, $options: "i" } },
        { category: { $regex: searchTerm, $options: "i" } },
      ];
    }

    // 7. Date range filter
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        filter.date.$lte = toDate;
      }
    }

    // Sorting
    let sortOption = { createdAt: -1 };
    if (sort === "oldest") {
      sortOption = { createdAt: 1 };
    }

    // Pagination
    const numLimit = Number(limit) || 9;
    const numPage = Math.max(Number(page) || 1, 1);
    const skip = (numPage - 1) * numLimit;

    // Base filter without type to accurately calculate tab counts (All, Lost, Found)
    const baseFilter = { ...filter };
    delete baseFilter.type;

    const [items, totalFiltered, totalLost, totalFound] = await Promise.all([
      Item.find(filter).sort(sortOption).skip(skip).limit(numLimit),
      Item.countDocuments(filter),
      Item.countDocuments({ ...baseFilter, type: "lost" }),
      Item.countDocuments({ ...baseFilter, type: "found" }),
    ]);

    const typeCounts = {
      all: totalLost + totalFound,
      lost: totalLost,
      found: totalFound,
    };

    res.status(200).json({
      success: true,
      count: totalFiltered,
      totalReports: totalFiltered,
      totalPages: Math.max(1, Math.ceil(totalFiltered / numLimit)),
      currentPage: numPage,
      typeCounts,
      data: items,
    });
  } catch (error) {
    console.error("Error in getAllItems:", error);
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