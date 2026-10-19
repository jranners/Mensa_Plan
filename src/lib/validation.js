/**
 * Schema Validation for Mensa Plan PWA
 */

/**
 * Validates the raw RPC response structure for public_get_week_menu.
 *
 * Expected structure:
 * Array< {
 *   date: "YYYY-MM-DD",
 *   dishes: Array< {
 *     id: string | number,
 *     name_de: string,
 *     custom_fields?: Array,
 *     screens?: Array | null,
 *     category?: object | null
 *   } >
 * } >
 *
 * @param {any} data
 * @param {{ requireNonEmptyDays?: boolean }} [options={}]
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateWeekMenu(data, options = {}) {
  if (!Array.isArray(data)) {
    return {
      valid: false,
      error: 'Menu data must be an array of days'
    };
  }

  if (options && options.requireNonEmptyDays && data.length === 0) {
    return {
      valid: false,
      error: 'Menu payload contains 0 days'
    };
  }

  for (let dIdx = 0; dIdx < data.length; dIdx++) {
    const day = data[dIdx];
    if (!day || typeof day !== 'object') {
      return {
        valid: false,
        error: `Day entry at index ${dIdx} is not an object`
      };
    }

    if (typeof day.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day.date)) {
      return {
        valid: false,
        error: `Day entry at index ${dIdx} has invalid date format: ${day.date}`
      };
    }

    if (!Array.isArray(day.dishes)) {
      return {
        valid: false,
        error: `Day entry at index ${dIdx} (${day.date}) dishes must be an array`
      };
    }

    for (let dishIdx = 0; dishIdx < day.dishes.length; dishIdx++) {
      const dish = day.dishes[dishIdx];
      if (!dish || typeof dish !== 'object') {
        return {
          valid: false,
          error: `Dish at index ${dishIdx} on ${day.date} is not an object`
        };
      }

      if (dish.id === undefined || dish.id === null || dish.id === '') {
        return {
          valid: false,
          error: `Dish at index ${dishIdx} on ${day.date} is missing an id`
        };
      }

      if (typeof dish.name_de !== 'string') {
        return {
          valid: false,
          error: `Dish at index ${dishIdx} on ${day.date} is missing name_de`
        };
      }

      if (dish.custom_fields !== undefined && dish.custom_fields !== null && !Array.isArray(dish.custom_fields)) {
        return {
          valid: false,
          error: `Dish at index ${dishIdx} on ${day.date} custom_fields must be an array`
        };
      }

      if (dish.screens != null && !Array.isArray(dish.screens)) {
        return {
          valid: false,
          error: `Dish at index ${dishIdx} on ${day.date} screens must be an array`
        };
      }

      if (dish.category != null && (typeof dish.category !== 'object' || Array.isArray(dish.category))) {
        return {
          valid: false,
          error: `Dish at index ${dishIdx} on ${day.date} category must be an object`
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Validates announcements array from announcements.json
 *
 * @param {any} data
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateAnnouncements(data) {
  if (!Array.isArray(data)) {
    return {
      valid: false,
      error: 'Announcements data must be an array'
    };
  }

  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return {
        valid: false,
        error: `Announcement at index ${i} must be a non-null object`
      };
    }

    const hasValidSchema =
      (typeof item.topic === 'string' && typeof item.content === 'string') ||
      typeof item.title === 'string' ||
      typeof item.text === 'string';

    if (!hasValidSchema) {
      return {
        valid: false,
        error: `Announcement at index ${i} is missing valid topic/content, title, or text fields`
      };
    }
  }

  return { valid: true };
}
