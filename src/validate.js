import { createManagementClient } from '@kontent-ai/management-sdk';
import { createDeliveryClient } from '@kontent-ai/delivery-sdk';


let dapiClient = null;
let mapiClient = null;
let contentTypes = null;
let environmentId = '';
let dapiPreviewKey = '';
let mapiKey = '';

function getKeys(config) {
  environmentId = (config && config.environmentId) ? config.environmentId : import.meta.env.VITE_KONTENT_ENVIRONMENT_ID;
  dapiPreviewKey = (config && config.dapiPreviewKey) ? config.dapiPreviewKey : import.meta.env.VITE_KONTENT_PREVIEW_API_KEY;
  mapiKey = (config && config.mapiKey) ? config.mapiKey : import.meta.env.VITE_KONTENT_MANAGEMENT_API_KEY;
}

/** Creates the management client */
function getManagementClient() {
  return createManagementClient({
    environmentId: environmentId,
    apiKey: mapiKey,
  });
}

/** Creates the delivery client */
function getDeliveryClient() {
  return createDeliveryClient({
    environmentId: environmentId,
    previewApiKey: dapiPreviewKey,
    defaultQueryConfig: {
      usePreviewMode: true,
    },
  });
}

/**
 * Load all of the content types in the environment
 * 
 * @returns List of content types
 */
async function getAllTypes() {
  const response = await mapiClient
    .listContentTypes()
    .toPromise();

  return response.data.items;
}

export async function validateLanguageVariant(itemCodename, languageCodename, configuration) {
  //console.clear();
  console.log(configuration);
  getKeys(configuration);
  mapiClient = getManagementClient();
  dapiClient = getDeliveryClient();
  contentTypes = await getAllTypes();

  const dapiResponse = await dapiClient
    .items(itemCodename)
    .languageParameter(languageCodename)
    .equalsFilter('system.codename', itemCodename)
    .equalsFilter('system.language', languageCodename)
    .depthParameter(2)
    .toPromise();

  const item = dapiResponse.data?.items[0];
  const contentType = contentTypes.find(type => type.codename === item.system.type);

  const errors = [];
  const elementList = await getTypeElements(contentType);

  // 3. Do loopy stuff
  elementList.forEach((elementDef) => {
    const elementValue = item.elements[elementDef.codename];

    if (elementDef.required && (!elementValue || (Array.isArray(elementValue) && elementValue.length === 0) || elementValue === '')) {
      errors.push(`Missing required field: ${elementDef.codename}`);
    }

    switch (elementDef.type) {
      case 'number':
        validateNumber(elementDef, elementValue, errors);
        break;
      case 'text':
      case 'url_slug':
        validateText(elementDef, elementValue, errors);
        break;
      case 'rich_text':
        validateRichText(elementDef, elementValue, errors);
        break;
      case 'multiple_choice':
        validateMultipleChoice(elementDef, elementValue, errors);
        break;
      case 'modular_content':
        validateModularContent(elementDef, elementValue, errors);
        break;
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a number based on the configuration in Kontent.AI
 */
function validateNumber(elementDef, elementValue, errors) {
  if (elementDef.is_required && elementValue.value === null) errors.push(`${elementDef.codename} is required`);
}

/**
 * Checks is a string has too many words.
 * 
 * @param {*} text The text to check
 * @param {*} maxWords The maximum number of words
 * @returns True is the string is OK.
 */
function validWordCount(text, maxWords) {
  const wordCount = text.trim().split(/\s+/).length;
  return wordCount <= maxWords;
}

/**
 * Validates the text and url_slug elemnts based on rules in Kontent.AI
 * 
 * @param {*} elementDef The type definition
 * @param {*} elementValue The element value
 * @param {*} errors Existing errors array to add to
 */
function validateText(elementDef, elementValue, errors) {
  if (elementDef.is_required && elementValue.value === "") errors.push(`${elementDef.codename} is required`);
  if (elementDef.maximum_text_length) {
    console.log(elementDef.maximum_text_length);
    if (elementDef.maximum_text_length.applies_to === 'characters' && elementValue.value.length > elementDef.maximum_text_length.value)
      errors.push(`${elementDef.codename} value is too long`);
    else {
      if (!validWordCount(elementValue.value, elementDef.maximum_text_length.value))
        errors.push(`${elementDef.codename} contains too many words`);
    }
  }
  validateRegex(elementDef, elementValue, errors);
}

/**
 * Takes a text-based element and looks to see if it passes and required regular expression
 */
function validateRegex(elementDef, elementValue, errors) {
  console.log(elementDef.validation_regex);
  if (elementDef.validation_regex && elementDef.validation_regex.is_active) {
    const regex = new RegExp(elementDef.validation_regex.regex, elementDef.validation_regex.flags ?? '');
    if (!regex.test(elementValue.value)) {
      errors.push(`${elementDef.codename} value does not match the regex: ${elementDef.validation_regex.validation_message}`);
    }
  }
}

/**
 * Validates RichText elements, checking for:
 * - empty values
 * 
 * @param {*} elementDef 
 * @param {*} elementValue 
 * @param {*} errors 
 */
function validateRichText(elementDef, elementValue, errors) {
  if (elementDef.is_required && elementValue.value === '<p><br></p>') {
    errors.push(`${elementDef.codename} is required`);
  }

  // TODO: Check for inline component validity.
}

/**
 * Loads elements from the current content type and any contained snippets.
 * 
 * @param {Object} contentType 
 * @returns 
 */
async function getTypeElements(contentType) {
  let elementList = contentType.elements;
  const snippetIds = contentType.elements.filter(f => f.type === 'snippet').map(m => m.snippet.id);
  const snippetPromises = snippetIds.map(async snippetId => {
    // 2. Load them and merge the elements with contentType.data.elements
    const snippetType = await mapiClient
      .viewContentTypeSnippet()
      .byTypeId(snippetId)
      .toPromise();

    return snippetType.data.elements;
  });

  const snippetElements = await Promise.all(snippetPromises);

  return elementList.concat(...snippetElements);
}

/**
 * Validates that all linked items are of allowed content types.
 *
 * @param {Array<string>} linkedItemCodenames - List of GUIDs from the content element.
 * @param {Object} linkedItems - Map of codename → content item.
 * @param {Array<string>} allowedTypeIds - List of allowed type GUIDs (not flat, the had an `id` prop).
 * @returns {Array<string>} - Codenames of invalid linked items.
 */
function findInvalidLinkedItemTypes(linkedItemCodenames, linkedItems, allowedTypeIds) {
  const invalid = [];

  // Convert allowed IDs to a Set for fast lookup
  if (allowedTypeIds.length === 0) return invalid;
  const allowedIds = new Set(allowedTypeIds.map(t => t.id));

  // Create a map of contentTypeCodename → ID for quick lookup
  const contentTypeMap = Object.fromEntries(
    contentTypes.map(type => [type.codename, type.id])
  );

  // Create a map of codename → linked item
  const linkedItemMap = Object.fromEntries(
    linkedItems.map(item => [item.system.codename, item])
  );

  for (const codename of linkedItemCodenames) {
    const item = linkedItemMap[codename];
    const typeId = contentTypeMap[item.system.type];

    if (!allowedIds.has(typeId) && !invalid.includes(item.system.type)) {
      invalid.push(item.system.type);
    }
  }

  return invalid;
}

/**
 * Validates an element from a content item that is modular content/linked items
 * 
 * @param {*} elementDef Configuration from the Management API
 * @param {*} elementValue Value of the element from the Delivery API
 * @param {*} errors Arrors array to add to
 * @returns 
 */
function validateModularContent(elementDef, elementValue, errors) {
  const count = (elementValue.value || [])?.length;

  if (elementDef.is_required && count === 0) errors.push(`${element.codename} is required`);

  if (count === 0) return;

  if (elementDef.allowed_content_types) {
    const invalidItems = findInvalidLinkedItemTypes(elementValue.value, elementValue.linkedItems, elementDef.allowed_content_types);
    errors.push(...invalidItems.map(item => `${elementDef.codename} does not allow ${item} types`));

  }

  if (elementDef.item_count_limit) {
    switch (elementDef.item_count_limit.condition) {
      case 'at_most':
        if (count > elementDef.item_count_limit.value) errors.push(`${elementDef.codename} has more than maximum allowed items (${elementDef.item_count_limit.value})`);
        break;
      case 'at_least':
        if (count < elementDef.item_count_limit.value) errors.push(`${elementDef.codename} has fewer than minimum allowed items (${elementDef.item_count_limit.value})`);
        break;
      case 'exactly':
        if (count !== elementDef.item_count_limit.value) errors.push(`${elementDef.codename} does not have the required number of items (${elementDef.item_count_limit.value})`);
        break;
    }
  }
}

/**
 * Validates a multiple_choice content element based upon lenght, and selected item(s)
 * 
 * @param {*} elementDef 
 * @param {*} elementValue 
 * @param {*} errors 
 * @returns 
 */
function validateMultipleChoice(elementDef, elementValue, errors) {
  if (elementDef.is_required && elementValue.value.length === 0) {
    errors.push(`${elementDef.codename} is required`);
    return;
  }

  if (elementDef.mode === 'single' && elementValue.value.length > 1) rrors.push(`${elementDef.codename} can only haveone value`);

  for (const value of elementValue.value) {
    if (!elementDef.options.find(option => option.codename === value.codename)) errors.push(`The value ${value.codename} is not a valid option for ${elementDef.codename}`);
  }
}

export async function moveToWorkflowStep(itemId, languageId, stepId) {
  const client = getManagementClient();

  await client.changeWorkflowStepOfLanguageVariant()
    .byItemId(itemId)
    .byLanguageId(languageId)
    .toStepId(stepId)
    .withoutWorkflowReset()
    .toPromise();
}