import { createManagementClient } from '@kontent-ai/management-sdk';
import { createDeliveryClient } from '@kontent-ai/delivery-sdk';


let dapiClient = null;
let mapiClient = null;
let contentTypes = null

/** Creates the management client */
function getManagementClient() {
  return createManagementClient({
    environmentId: import.meta.env.VITE_KONTENT_ENVIRONMENT_ID,
    apiKey: import.meta.env.VITE_KONTENT_MANAGEMENT_API_KEY,
  });
}

/** Creates the delivery client */
function getDeliveryClient() {
  return createDeliveryClient({
    environmentId: import.meta.env.VITE_KONTENT_ENVIRONMENT_ID,
    previewApiKey: import.meta.env.VITE_KONTENT_PREVIEW_API_KEY,
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

/**
 * Loads elements from the current content type and any contained snippets.
 * 
 * @param {Object} contentType 
 * @returns 
 */
async function getTypeElements(contentType) {
  console.log(contentType);
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
 * Validates an element from a content item that is modular content/linked items
 * 
 * @param {*} elementConfig Configuration from the Management API
 * @param {*} elementValue Value of the element from the Delivery API
 * @param {*} linkedItems Any linked items on the content item (from the delivery API)
 * @param {*} errors Arrors array to add to
 * @returns 
 */
function validateModularContent(elementConfig, elementValue, linkedItems, errors) {
  console.log(`Validating ${elementConfig.codename}`);
  console.log(elementValue);

  const count = (elementValue || []).length;
  console.log(`\tFound ${count} items`);

  if (elementConfig.is_required && count === 0) errors.push(`${element.codename} is required`);

  if (count === 0) return;

  if (elementConfig.allowed_content_types) {
    console.log(elementConfig.allowed_content_types);
  }

  if (elementConfig.item_count_limit) {
    switch (elementConfig.item_count_limit.condition) {
      case 'at_most':
        if (count > elementConfig.item_count_limit.value) errors.push(`${elementConfig.codename} has more than maximum allowed items (${elementConfig.item_count_limit.value})`);
        break;
      case 'at_least':
        if (count < elementConfig.item_count_limit.value) errors.push(`${elementConfig.codename} has fewer than minimum allowed items (${elementConfig.item_count_limit.value})`);
        break;
      case 'exactly':
        if (count !== elementConfig.item_count_limit.value) errors.push(`${elementConfig.codename} does not have the required number of items (${elementConfig.item_count_limit.value})`);
        break;
    }
  }
}

export async function validateLanguageVariant(itemCodename, languageCodename) {
  console.clear();
  mapiClient = getManagementClient();
  dapiClient = getDeliveryClient();
  contentTypes = await getAllTypes();

  console.log(contentTypes);

  const dapiResponse = await dapiClient
    .items(itemCodename)
    .languageParameter(languageCodename)
    .equalsFilter('system.codename', itemCodename)
    .equalsFilter('system.language', languageCodename)
    .depthParameter(2)
    .toPromise();

  const item = dapiResponse.data?.items[0];
  const linkedItems = dapiResponse.data?.linkedItems;

  const contentType = contentTypes.find(type => type.codename === item.system.type);

  const errors = [];
  const elementList = await getTypeElements(contentType);

  // 3. Do loopy stuff
  elementList.forEach((element) => {
    const value = item.elements[element.codename];

    if (element.required && (!value || (Array.isArray(value) && value.length === 0) || value === '')) {
      errors.push(`Missing required field: ${element.codename}`);
    }

    if (element.type === 'rich_text') {
      if (element.is_required && element.value === '<p><br/></p>') errors.push(`${element.codename} is required`);
    }

    if (element.type === 'modular_content') {
      validateModularContent(element, value, linkedItems, errors);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
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