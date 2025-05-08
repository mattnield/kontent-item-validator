import { createManagementClient } from '@kontent-ai/management-sdk';
import { createDeliveryClient } from '@kontent-ai/delivery-sdk';


let dapiClient = null;
let mapiClient = null;
let contentTypes = null;
let environmentId = '';
let dapiPreviewKey = '';
let mapiKey = '';
let workflowCodename = '';
let toStepCodename = '';
let fromStepCodename = '';
let currentStepCodename = ''

function getKeys(config) {
  environmentId = (config && config.environmentId) ? config.environmentId : import.meta.env.VITE_KONTENT_ENVIRONMENT_ID;
  dapiPreviewKey = (config && config.dapiPreviewKey) ? config.dapiPreviewKey : import.meta.env.VITE_KONTENT_PREVIEW_API_KEY;
  mapiKey = (config && config.mapiKey) ? config.mapiKey : import.meta.env.VITE_KONTENT_MANAGEMENT_API_KEY;
  workflowCodename = (config && config.worflowCodename) ? config.worflowCodename : import.meta.env.VITE_WORKFLOW_CODENAME;
  toStepCodename = (config && config.toStepCodename) ? config.toStepCodename : import.meta.env.VITE_TO_STEP_CODENAME;
  fromStepCodename = (config && config.fromStepCodename) ? config.fromStepCodename : import.meta.env.VITE_FROM_STEP_CODENAME;

  console.log(`env:${environmentId}\ndapi:${dapiPreviewKey}\nmapi:${mapiKey}\nworkflow:${workflowCodename}\nto_step:${toStepCodename}\nfrom_step:${fromStepCodename}\n`);
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

export async function validateLanguageVariant(itemCodename, languageCodename, configuration, deps = {}) {
  getKeys(configuration);
  mapiClient = deps.managementClient || getManagementClient();
  dapiClient = deps.deliveryClient || getDeliveryClient();
  contentTypes = await getAllTypes();


  const dapiResponse = await dapiClient
    .items(itemCodename)
    .queryConfig({ waitForLoadingNewContent: true })
    .languageParameter(languageCodename)
    .equalsFilter('system.codename', itemCodename)
    .equalsFilter('system.language', languageCodename)
    .depthParameter(1)
    .toPromise();

  const item = dapiResponse.data?.items[0];
  currentStepCodename = item.system.workflowStep;

  if (currentStepCodename != fromStepCodename) {
    return {
      isReady: false,
      isValid: false,
      errors: []
    };
  }

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
      case 'custom':
        errors.push(...validateCustomElement(elementDef, elementValue));
        break;
      case 'taxonomy':
        errors.push(...validateTaxonomyElement(elementDef, elementValue));
        break;
      case 'asset':
        errors.push(...validateAssetElement(elementDef, elementValue));
        break;
      case 'date_time':
        errors.push(...validateDateElement(elementDef, elementValue));
        break;
      case 'number':
        errors.push(...validateNumberElement(elementDef, elementValue));
        break;
      case 'text':
      case 'url_slug':
        errors.push(...validateTextElement(elementDef, elementValue));
        break;
      case 'rich_text':
        errors.push(...validateRichTextElement(elementDef, elementValue));
        break;
      case 'multiple_choice':
        errors.push(...validateMultipleChoiceElement(elementDef, elementValue));
        break;
      case 'modular_content':
        errors.push(...validateModularContentElement(elementDef, elementValue, contentTypes));
        break;
    }
  });

  return {
    isReady: true,
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a number based on the configuration in Kontent.AI
 */
export function validateAssetElement(elementDef, elementValue, ignoreRequired = false) {
  let errors = [];
  if (!ignoreRequired && elementDef.is_required && elementValue.value.length === 0) {
    errors.push(`${elementDef.codename} is required`);
    return errors;
  }

  // Number limit
  if (elementDef.asset_count_limit) {
    const count = elementValue.value.length;
    switch (elementDef.asset_count_limit.condition) {
      case 'at_least':
        if (elementDef.asset_count_limit.value > count) errors.push(`${elementDef.codename} does not have enough assets`);
        break;
      case 'exactly':
        if (elementDef.asset_count_limit.value !== count) errors.push(`${elementDef.codename} does not have the correct number of assets`);
        break;
      default:
        if (elementDef.asset_count_limit.value < count) errors.push(`${elementDef.codename} has too many assets`);
        break;
    }
  }
  for (const asset of elementValue.value) {
    // Width limit
    errors.push(...validateIndividualAsset(elementDef, asset));
  }

  return errors;
}

function validateIndividualAsset(elementDef, asset) {
  let errors = [];
  const adjustableImageMimeTypes = new Set([
    'image/webp',
    'image/jpeg',
    'image/png',
    'image/gif'
  ]);
  if (elementDef.image_width_limit) {
    switch (elementDef.image_width_limit.condition) {
      case 'at_least':
        if (elementDef.image_width_limit.value > asset.width) errors.push(`${elementDef.codename} specifies an asset which is not wide enough`);
        break;
      case 'exactly':
        if (elementDef.image_width_limit.value !== asset.width) errors.push(`${elementDef.codename} specifies an asset which is not the right width`);
        break;
      default:
        if (elementDef.image_width_limit.value < asset.width) errors.push(`${elementDef.codename} specifies an asset which is too wide`);
        break;
    }
  }
  // Height limit
  if (elementDef.image_height_limit) {
    switch (elementDef.image_height_limit.condition) {
      case 'at_least':
        if (elementDef.image_height_limit.value > asset.height) errors.push(`${elementDef.codename} specifies an asset which is not high enough`);
        break;
      case 'exactly':
        if (elementDef.image_height_limit.value !== asset.height) errors.push(`${elementDef.codename} specifies an asset which is not the right height`);
        break;
      default:
        if (elementDef.image_height_limit.value < asset.height) errors.push(`${elementDef.codename} specifies an asset which is too high`);
        break;
    }
  }
  // Size limit
  if (elementDef.maximum_file_size) {
    if (asset.size > elementDef.maximum_file_size) errors.push(`${elementDef.codename} specifies an asset which is too large`);
  }
  // Type limit
  if (elementDef.allowed_file_types === 'adjustable') {
    // Adjustable images are: image/webp, image/jpeg, image/png, image/gif
    if (!adjustableImageMimeTypes.has(asset.type)) errors.push(`${elementDef.codename} specifies an esset that is not an adjustable image`);
  }
  return errors;
}

/**
 * Validates a custom element value against the type definition
 * 
 * @param {*} elementDef 
 * @param {*} elementValue 
 */
export function validateCustomElement(elementDef, elementValue) {
  let errors = [];
  if (elementDef.is_required && (elementValue.value ?? '') === '') {
    errors.push(`${elementDef.codename} is required`);
    return errors;
  }
  return errors;
}

/**
 * Validates a date/time based on the configuration in Kontent.AI
 */
export function validateDateElement(elementDef, elementValue) {
  let errors = [];
  if (elementDef.is_required && (elementValue.value === null || elementValue.value === '')) errors.push(`${elementDef.codename} is required`);
  return errors;
}

/**
 * Validates an element from a content item that is modular content/linked items
 * 
 * @param {*} elementDef Configuration from the Management API
 * @param {*} elementValue Value of the element from the Delivery API
 * @param {*} errors Arrors array to add to
 * @returns 
 */
export function validateModularContentElement(elementDef, elementValue, knownContentTypes) {
  let errors = [];
  const count = (elementValue.value || [])?.length;

  if (elementDef.is_required && count === 0) errors.push(`${elementDef.codename} is required`);

  if (count === 0) return errors;

  if (elementDef.allowed_content_types) {
    const invalidItems = findInvalidLinkedItemTypes(elementValue.value, elementValue.linkedItems, elementDef.allowed_content_types, knownContentTypes);
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

  return errors;
}

/**
 * Validates a multiple_choice content element based upon lenght, and selected item(s)
 * 
 * @param {*} elementDef 
 * @param {*} elementValue 
 * @param {*} errors 
 * @returns 
 */
export function validateMultipleChoiceElement(elementDef, elementValue) {
  let errors = [];
  if (elementDef.is_required && elementValue.value.length === 0) {
    errors.push(`${elementDef.codename} is required`);
    return errors;
  }

  if (elementDef.mode === 'single' && elementValue.value.length > 1) errors.push(`${elementDef.codename} can only haveone value`);

  for (const value of elementValue.value) {
    if (!elementDef.options.find(option => option.codename === value.codename)) errors.push(`The value ${value.codename} is not a valid option for ${elementDef.codename}`);
  }

  return errors;
}

/**
 * Validates a number based on the configuration in Kontent.AI
 */
export function validateNumberElement(elementDef, elementValue) {
  let errors = [];
  if (elementDef.is_required && (elementValue.value === null || elementValue.value === '')) errors.push(`${elementDef.codename} is required`);
  return errors;
}

function richtextElementSupportsText(elementDef) { return (!elementDef.allowed_blocks || elementDef.allowed_blocks.length == 0 || elementDef.allowed_blocks.includes('text')); }
function richtextElementSupportsTables(elementDef) { return (!elementDef.allowed_blocks || elementDef.allowed_blocks.length == 0 || elementDef.allowed_blocks.includes('tables')); }
function richtextElementSupportsImages(elementDef) { return (!elementDef.allowed_blocks || elementDef.allowed_blocks.length == 0 || elementDef.allowed_blocks.includes('images')); }
function richtextElementSupportsComponents(elementDef) { return (!elementDef.allowed_blocks || elementDef.allowed_blocks.length == 0 || elementDef.allowed_blocks.includes('components-and-items')); }

/**
 * Validates RichText elements, checking for:
 * - empty values
 * 
 * @param {*} elementDef Defenition of the type being processed
 * @param {*} elementValue Value of the item being processed
 * @param {*} contentTypes Any content types needed to validate the item
 * @param {*} modularContent Any modular content associated with the item
 */
export function validateRichTextElement(elementDef, elementValue, contentTypes, modularContent) {
  let errors = [];
  if (elementDef.is_required && (!elementValue.value || elementValue.value === '' || elementValue.value === '<p><br></p>')) {
    errors.push(`${elementDef.codename} is required`);
  }

  if (richtextElementSupportsText(elementDef)) {
    validateRichTextMarkup(elementDef, elementValue, errors);
  }
  validateRichTextImages(elementDef, elementValue, errors);
  validateRichTextComponents(elementDef, contentTypes, modularContent, errors);
  // TODO: Check for inline component validity.

  return errors;
}

function validateRichTextMarkup(elementDef, elementValue, errors) {

  if (!elementValue.value) return;
  if (elementValue.value == '<p><br></p>') return;
  if (elementDef.allowed_text_blocks?.length == 0) {
    return;
  }

  const supportedTags = [
    { name: 'paragraph', tag: 'p', type: 'text_block' },
    { name: 'heading-one', tag: 'h1', type: 'text_block' },
    { name: 'heading-two', tag: 'h2', type: 'text_block' },
    { name: 'heading-three', tag: 'h3', type: 'text_block' },
    { name: 'heading-four', tag: 'h4', type: 'text_block' },
    { name: 'heading-five', tag: 'h5', type: 'text_block' },
    { name: 'heading-six', tag: 'h6', type: 'text_block' },
    { name: 'ordered-list', tag: 'ol', type: 'text_block' },
    { name: 'unordered-list', tag: 'ul', type: 'text_block' },
    { name: 'bold', tag: 'strong', type: 'formatting' },
    { name: 'italic', tag: 'em', type: 'formatting' },
    { name: 'superscript', tag: 'sup', type: 'formatting' },
    { name: 'subscript', tag: 'sub', type: 'formatting' },
    { name: 'code', tag: 'code', type: 'formatting' },
    { name: 'link', tag: 'a', type: 'formatting' },
    { name: 'unstyled', tag: 'p', type: 'formatting' },
    { name: 'newline', tag: 'br', type: 'text_block' }
  ];

  // Get all the tags _not_ in a table.
  const htmlWithoutTables = elementValue.value.replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, '');
  const foundTags = htmlWithoutTables.matchAll(/<([a-zA-Z][^\s/>]*)(\s[^<>]*?)?\/?>/g);

  for (const foundTag of foundTags) {
    if (richtextElementSupportsComponents(elementDef) && foundTag[1] === 'object') {
      // we need to check if it is a component
      continue;
    }

    // if (richtextElementSupportsImages(elementDef) && ['figure', 'img'].includes(foundTag[1])) {
    //   continue;
    // }

    if (richtextElementSupportsText(elementDef)) {
      // is the tag generally supported?
      const supportedTag = supportedTags.find(st => st.tag === foundTag[1]);
      if (!supportedTag) {
        errors.push(`Unsupported tag "${foundTag}" found`);
        continue;
      }

      // check the allowed text block on the element
      if (
        elementDef.allowed_text_blocks
        && elementDef.allowed_text_blocks.length > 0
        && supportedTag.type === "text_block"
        && !elementDef.allowed_text_blocks?.includes(supportedTag.name)
      ) {
        errors.push(`Block "${supportedTag.name}" is not allowed`);
        continue;
      }

      // Check for supported formatting
      if (elementDef.allowed_formatting && supportedTag.type === "formatting" && !elementDef.allowed_formatting?.includes(supportedTag.name)) {

        errors.push(`Formatting "${supportedTag.name}" is not allowed`);
        continue;
      }
    }
  }
}

function validateRichTextComponents(elementDef, contentTypes, modularContent, errors) {
  if (elementDef.allowed_blocks?.length > 0 && !elementDef.allowed_blocks?.includes('components_and_items')) {
    if (Object.values(modularContent ?? {})?.length > 0) {
      errors.push('components are not supported');
      return;
    }
    return;
  }
  var components = Object.values(modularContent ?? {});
  if (!components) return;

  for (const component of components) {
    const type = contentTypes.find(t => t.codename == component.system.type)
    if (!type) {
      errors.push(`unknown content type "${component.system.type}" in modular content`);
      continue;
    }

    if (!elementDef.allowed_content_types.find(t => t.id === type.id)) {
      errors.push(`content type ${component.system.type} is not allowed`);
      continue;
    }
  }
}

function validateRichTextImages(elementDef, elementValue, errors) {
  if (elementDef.allowed_blocks?.length > 0 && !elementDef.allowed_blocks?.includes('images')) {
    if (Object.values(elementValue.images ?? {})?.length > 0) {
      errors.push('images are not supported');
      return;
    }
    return;
  }

  var images = Object.values(elementValue.images ?? {});
  if (images) {
    for (var image of Object.values(images)) {
      errors.push(...validateIndividualAsset(elementDef, image));
    }
  }
}

/**
 * Validates a taxonomy element value against the type definition
 * 
 * @param {*} elementDef 
 * @param {*} elementValue 
 */
export function validateTaxonomyElement(elementDef, elementValue) {
  let errors = [];
  if (elementDef.is_required && elementValue.value.length === 0) {
    errors.push(`${elementDef.codename} is required`);
    return errors;
  }

  if (elementDef.term_count_limit) {
    const count = elementValue.value.length;
    switch (elementDef.term_count_limit.condition) {
      case 'at_least':
        if (elementDef.term_count_limit.value > count) errors.push(`${elementDef.codename} does not have enough terms`);
        break;
      case 'exactly':
        if (elementDef.term_count_limit.value !== count) errors.push(`${elementDef.codename} does not have the correct number of terms`);
        break;
      default:
        if (elementDef.term_count_limit.value < count) errors.push(`${elementDef.codename} has too many terms`);
        break;
    }
  }

  return errors;
}

/**
 * Validates the text and url_slug elemnts based on rules in Kontent.AI
 * 
 * @param {*} elementDef The type definition
 * @param {*} elementValue The element value
 */
export function validateTextElement(elementDef, elementValue) {
  let errors = [];
  if (elementDef.is_required && elementValue.value === "") {
    errors.push(`${elementDef.codename} is required`);
    return errors;
  }
  if (elementDef.maximum_text_length) {
    if (elementDef.maximum_text_length.applies_to === 'characters' && elementValue.value.length > elementDef.maximum_text_length.value)
      errors.push(`${elementDef.codename} value is too long`);
    else {
      if (!validWordCount(elementValue.value, elementDef.maximum_text_length.value))
        errors.push(`${elementDef.codename} contains too many words`);
    }
  }
  errors.push(...validateRegex(elementDef, elementValue));

  return errors;
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
 * Takes a text-based element and looks to see if it passes and required regular expression
 */
function validateRegex(elementDef, elementValue) {
  let errors = [];
  if (elementDef.validation_regex && elementDef.validation_regex.is_active) {
    const regex = new RegExp(elementDef.validation_regex.regex, elementDef.validation_regex.flags ?? '');
    if (!regex.test(elementValue.value)) {
      errors.push(`${elementDef.codename} value does not match the regex: ${elementDef.validation_regex.validation_message}`);
    }
  }

  return errors;
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
function findInvalidLinkedItemTypes(linkedItemCodenames, linkedItems, allowedTypeIds, knownContentTypes) {
  const invalid = [];

  // Convert allowed IDs to a Set for fast lookup
  if (allowedTypeIds.length === 0) return invalid;
  const allowedIds = new Set(allowedTypeIds.map(t => t.id));

  // Create a map of contentTypeCodename → ID for quick lookup
  const contentTypeMap = Object.fromEntries(
    knownContentTypes.map(type => [type.codename, type.id])
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

export async function moveToWorkflowStep(itemId, languageCodename) {
  const client = getManagementClient();

  await client.changeWorkflowOfLanguageVariant()
    .byItemId(itemId)
    .byLanguageCodename(languageCodename)
    .withData({
      step_identifier: {
        codename: toStepCodename
      },
      workflow_identifier: {
        codename: workflowCodename
      }
    }).toPromise();

  setTimeout(function () {
    console.log(`Item ${itemId} updated to ${toStepCodename}`);
  }, 1000);
}