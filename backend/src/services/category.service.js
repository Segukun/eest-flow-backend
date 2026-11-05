import Category from "../models/category.model.js";
import ApiError from "../utils/apiError.js";
import {
  buildSectorVisibilityFilter,
  canAccessBySector,
} from "./visibility.service.js";

export const createCategory = async (categoryData) => {
  const exists = await Category.findOne({ name: categoryData.name.trim() });
  if (exists) {
    throw new ApiError(400, "Category already exists");
  }
  return await Category.create(categoryData);
};

// Admin: todas. Colaborador: solo las de sus sectores.
export const getCategories = async (user) => {
  return await Category.find({
    active: true,
    ...buildSectorVisibilityFilter(user),
  });
};

// Ids de las categorías que el usuario puede ver (lo usa task.service).
export const getVisibleCategoryIds = async (user) => {
  const categories = await Category.find({
    active: true,
    ...buildSectorVisibilityFilter(user),
  }).select("_id");

  return categories.map((category) => category._id);
};

export const getCategoryById = async (categoryId, user) => {
  const category = await Category.findById(categoryId);

  // 404 (no 403) para no revelar que la categoría existe.
  if (!category || !canAccessBySector(user, category.sectors)) {
    throw new ApiError(404, "Category not found");
  }

  return category;
};

export const updateCategory = async (categoryId, categoryData) => {
  const category = await Category.findByIdAndUpdate(categoryId, categoryData, {
    returnDocument: "after",
    runValidators: true,
  });
  if (!category) throw new ApiError(404, "Category not found");
  return category;
};

//TODO: Cuando pasa esto eliminar el contenido del campo category de las tarjetas asociadas.
export const disableCategory = async (categoryId) => {
  const category = await Category.findByIdAndUpdate(
    categoryId,
    { active: false },
    { returnDocument: "after" },
  );
  if (!category) throw new ApiError(404, "Category not found");
  return category;
};