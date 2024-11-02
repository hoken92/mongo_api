import express from "express";
import db from "../db/conn.js";

const router = express.Router();

/**
 * It is not best practice to seperate these routes
 * like we have done here. This file was created
 * specifically for educational purposes, to contain
 * all aggregation routes in one place.
 */

/**
 * Grading Weights by Score Type:
 * - Exams: 50%
 * - Quizes: 30%
 * - Homework: 20%
 */

// Create Single and compount indexes
db.collection("grades").createIndex({ class_id: 1 });
db.collection("grades").createIndex({ learner_id: 1 });
db.collection("grades").createIndex({ learner_id: 1, class_id: 1 });

// Get the weighted average of a specified learner's grades, per class
router.get("/learner/:id/avg-class", async (req, res) => {
  let collection = db.collection("grades");

  let result = await collection
    .aggregate([
      {
        $match: { learner_id: Number(req.params.id) },
      },
      {
        $unwind: { path: "$scores" },
      },
      {
        $group: {
          _id: "$class_id",
          quiz: {
            $push: {
              $cond: {
                if: { $eq: ["$scores.type", "quiz"] },
                then: "$scores.score",
                else: "$$REMOVE",
              },
            },
          },
          exam: {
            $push: {
              $cond: {
                if: { $eq: ["$scores.type", "exam"] },
                then: "$scores.score",
                else: "$$REMOVE",
              },
            },
          },
          homework: {
            $push: {
              $cond: {
                if: { $eq: ["$scores.type", "homework"] },
                then: "$scores.score",
                else: "$$REMOVE",
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          class_id: "$_id",
          avg: {
            $sum: [
              { $multiply: [{ $avg: "$exam" }, 0.5] },
              { $multiply: [{ $avg: "$quiz" }, 0.3] },
              { $multiply: [{ $avg: "$homework" }, 0.2] },
            ],
          },
        },
      },
    ])
    .toArray();

  if (!result) res.send("Not found").status(404);
  else res.send(result).status(200);
});

// Total number of learners
router.get("/stats", async (req, res) => {
  let collection = db.collection("grades");

  // Finds the number of TOTAL learners above 50%
  const weightedAvg = await collection
    .aggregate([
      {
        $unwind: {
          path: "$scores",
        },
      },
      {
        $group: {
          _id: "$learner_id",
          quiz: {
            $push: {
              $cond: {
                if: {
                  $eq: ["$scores.type", "quiz"],
                },
                then: "$scores.score",
                else: "$$REMOVE",
              },
            },
          },
          exam: {
            $push: {
              $cond: {
                if: {
                  $eq: ["$scores.type", "exam"],
                },
                then: "$scores.score",
                else: "$$REMOVE",
              },
            },
          },
          homework: {
            $push: {
              $cond: {
                if: {
                  $eq: ["$scores.type", "homework"],
                },
                then: "$scores.score",
                else: "$$REMOVE",
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          learner_id: "$_id",
          avg: {
            $sum: [
              {
                $multiply: [
                  {
                    $avg: "$exam",
                  },
                  0.5,
                ],
              },
              {
                $multiply: [
                  {
                    $avg: "$quiz",
                  },
                  0.3,
                ],
              },
              {
                $multiply: [
                  {
                    $avg: "$homework",
                  },
                  0.2,
                ],
              },
            ],
          },
        },
      },
      {
        $match: {
          avg: { $gt: 50 },
        },
      },
      {
        $count: "learners_above_50_percent",
      },
    ])
    .toArray();

  // Finds the total number of learners
  const totalLearners = await collection
    .aggregate([
      {
        $group: {
          _id: "$learner_id",
          class_id: { $push: "$class_id" },
        },
      },
      {
        $count: "total_learners",
      },
    ])
    .toArray();

  const report = [];

  // Calculates percentage of ALL learners above 50%
  const percentageOfLearners = (
    weightedAvg[0].learners_above_50_percent / totalLearners[0].total_learners
  ).toFixed(2);
  report.push(weightedAvg, totalLearners, percentageOfLearners);

  if (!report) res.send("Not found").status(404);
  else res.send(report).status(200);
});

// Returns specifc average to class ID
router.get("/stats/:id", async (req, res) => {
  let collection = db.collection("grades");

  if (!req.params.id) {
    res.status(400).send("Not found");
    return;
  }

  // Returns the count of class learners above 50%
  const learners_above_50 = await collection
    .aggregate([
      {
        $match: {
          class_id: Number(req.params.id),
        },
      },
      {
        $unwind: {
          path: "$scores",
        },
      },
      {
        $group: {
          _id: "$learner_id",
          quiz: {
            $push: {
              $cond: {
                if: {
                  $eq: ["$scores.type", "quiz"],
                },
                then: "$scores.score",
                else: "$$REMOVE",
              },
            },
          },
          exam: {
            $push: {
              $cond: {
                if: {
                  $eq: ["$scores.type", "exam"],
                },
                then: "$scores.score",
                else: "$$REMOVE",
              },
            },
          },
          homework: {
            $push: {
              $cond: {
                if: {
                  $eq: ["$scores.type", "homework"],
                },
                then: "$scores.score",
                else: "$$REMOVE",
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          learner_id: "$_id",
          avg: {
            $sum: [
              {
                $multiply: [
                  {
                    $avg: "$exam",
                  },
                  0.5,
                ],
              },
              {
                $multiply: [
                  {
                    $avg: "$quiz",
                  },
                  0.3,
                ],
              },
              {
                $multiply: [
                  {
                    $avg: "$homework",
                  },
                  0.2,
                ],
              },
            ],
          },
        },
      },
      {
        $match: {
          avg: { $gt: 50 },
        },
      },
      {
        $count: "learners_above_50",
      },
    ])
    .toArray();

  // Returns total number of learners in the class id
  const class_learners = await collection
    .aggregate([
      {
        $match: {
          class_id: Number(req.params.id),
        },
      },
      {
        $count: "class_learners",
      },
    ])
    .toArray();

  // Calculates the percentage of learners that have a grade above 50%
  const percentage = (
    learners_above_50[0].learners_above_50 / class_learners[0].class_learners
  ).toFixed(2);

  const report = [];
  report.push(learners_above_50, class_learners, percentage);

  if (!report) res.send("Not found").status(404);
  else res.send(report).status(200);
});

export default router;
