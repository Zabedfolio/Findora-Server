import Item from "../models/item.model.js";

/**
 * Get aggregated dashboard telemetry for the authenticated user
 * GET /api/dashboard/user-stats?userId=...&email=...
 */
export const getUserDashboardStats = async (req, res) => {
  try {
    const { userId, email } = req.query;

    if (!userId && !email) {
      return res.status(200).json({
        success: true,
        data: {
          totalReports: 0,
          activeLost: 0,
          activeFound: 0,
          resolvedCount: 0,
          resolutionRate: 0,
          categoryBreakdown: [],
          recentReports: [],
        },
      });
    }

    const matchFilter = {
      $or: [
        ...(userId ? [{ "postedBy.userId": userId }] : []),
        ...(email ? [{ "postedBy.email": email }] : []),
      ],
    };

    const [stats, categories, recentReports] = await Promise.all([
      Item.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: null,
            totalReports: { $sum: 1 },
            activeLost: {
              $sum: {
                $cond: [{ $and: [{ $eq: ["$type", "lost"] }, { $eq: ["$status", "active"] }] }, 1, 0],
              },
            },
            activeFound: {
              $sum: {
                $cond: [{ $and: [{ $eq: ["$type", "found"] }, { $eq: ["$status", "active"] }] }, 1, 0],
              },
            },
            resolvedCount: {
              $sum: {
                $cond: [{ $eq: ["$status", "resolved"] }, 1, 0],
              },
            },
          },
        },
      ]),

      Item.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: "$category",
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),

      Item.find(matchFilter).sort({ createdAt: -1 }).limit(5),
    ]);

    const aggregate = stats[0] || {
      totalReports: 0,
      activeLost: 0,
      activeFound: 0,
      resolvedCount: 0,
    };

    const resolutionRate = aggregate.totalReports > 0
      ? Math.round((aggregate.resolvedCount / aggregate.totalReports) * 100)
      : 0;

    res.status(200).json({
      success: true,
      data: {
        totalReports: aggregate.totalReports,
        activeLost: aggregate.activeLost,
        activeFound: aggregate.activeFound,
        activeTotal: aggregate.activeLost + aggregate.activeFound,
        resolvedCount: aggregate.resolvedCount,
        resolutionRate,
        categoryBreakdown: categories.map((c) => ({
          category: c._id || "Other",
          count: c.count,
        })),
        recentReports,
      },
    });
  } catch (error) {
    console.error("User dashboard stats error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to compute user dashboard telemetry",
    });
  }
};

/**
 * Get platform-wide aggregated metrics for the Admin Control Center
 * GET /api/dashboard/admin-metrics
 */
export const getAdminDashboardMetrics = async (req, res) => {
  try {
    const [overview] = await Item.aggregate([
      {
        $facet: {
          counts: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                lostCount: {
                  $sum: { $cond: [{ $eq: ["$type", "lost"] }, 1, 0] },
                },
                foundCount: {
                  $sum: { $cond: [{ $eq: ["$type", "found"] }, 1, 0] },
                },
                resolvedCount: {
                  $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] },
                },
              },
            },
          ],
          categories: [
            {
              $group: {
                _id: "$category",
                count: { $sum: 1 },
                resolved: {
                  $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] },
                },
              },
            },
            { $sort: { count: -1 } },
            { $limit: 8 },
          ],
          topLocations: [
            {
              $match: {
                location: { $exists: true, $ne: "" },
              },
            },
            {
              $group: {
                _id: "$location",
                count: { $sum: 1 },
                lost: {
                  $sum: { $cond: [{ $eq: ["$type", "lost"] }, 1, 0] },
                },
                found: {
                  $sum: { $cond: [{ $eq: ["$type", "found"] }, 1, 0] },
                },
                resolved: {
                  $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] },
                },
              },
            },
            { $sort: { count: -1 } },
            { $limit: 20 },
          ],
          recentListings: [
            { $sort: { createdAt: -1 } },
            { $limit: 10 },
          ],
        },
      },
    ]);

    const aggregate = overview?.counts[0] || {
      total: 0,
      lostCount: 0,
      foundCount: 0,
      resolvedCount: 0,
    };

    const recoveryRate = aggregate.total > 0
      ? Math.round((aggregate.resolvedCount / aggregate.total) * 100)
      : 0;

    res.status(200).json({
      success: true,
      data: {
        totalInventory: aggregate.total,
        lostCount: aggregate.lostCount,
        foundCount: aggregate.foundCount,
        resolvedCount: aggregate.resolvedCount,
        recoveryRate,
        categories: (overview?.categories || []).map((cat) => ({
          name: cat._id || "Uncategorized",
          count: cat.count,
          resolved: cat.resolved,
        })),
        topLocations: (overview?.topLocations || []).map((loc) => ({
          name: loc._id || "Dhaka Metropolitan",
          location: loc._id || "Dhaka Metropolitan",
          lost: loc.lost || 0,
          found: loc.found || 0,
          total: loc.count || 0,
          count: loc.count || 0,
          resolved: loc.resolved || 0,
          rate: loc.count > 0 ? Math.round((loc.resolved / loc.count) * 100) : 0,
        })),
        recentListings: overview?.recentListings || [],
      },
    });
  } catch (error) {
    console.error("Admin dashboard metrics error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to compute admin platform metrics",
    });
  }
};
