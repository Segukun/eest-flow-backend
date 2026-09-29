import Label from "../models/label.model.js";
import ApiError from "../utils/apiError.js";

export const createLabel = async ({ title, color, category }) => {
  const trimmedTitle = title?.trim();

  if (trimmedTitle) {
    const exists = await Label.findOne({
      title: trimmedTitle,
      category,
      active: true,
    });
    if (exists) {
      throw new ApiError(409, "A Label with that title already exists");
    }
  }

  return await Label.create({ title: trimmedTitle ?? "", color, category });
};

export const getLabels = async (categoryId) => {
  return await Label.find({ category: categoryId, active: true }).sort({
    title: 1,
  });
};

export const getLabelById = async (labelId) => {
  const label = await Label.findById(labelId);
  if (!label) throw new ApiError(404, "Label not found");
  return label;
};

export const updateLabel = async (labelId, { title, color, category }) => {
  const label = await Label.findByIdAndUpdate(
    labelId,
    { title, color, category },
    { returnDocument: "after", runValidators: true },
  );

  if (!label) throw new ApiError(404, "Label not found");
  return label;
};

export const disableLabel = async (labelId) => {
  const label = await Label.findByIdAndUpdate(
    labelId,
    { active: false },
    { returnDocument: "after" },
  );
  if (!label) throw new ApiError(404, "Label not found");
  return label;
};

export const validateLabelExist = async (labelIds = []) => {
  if (!Array.isArray(labelIds) || labelIds.length === 0) {
    throw new ApiError(400, "labels must be a non-empty array");
  }

  const count = await Label.countDocuments({
    _id: { $in: labelIds },
    active: true,
  });

  if (count !== labelIds.length) {
    throw new ApiError(400, "One or more labels are invalid");
  }
};
