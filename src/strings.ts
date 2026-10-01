// All UI copy lives here so it's one file to translate later (isiXhosa / isiZulu).
export const t = {
  appName: 'Spaza POS',
  nav: { home: 'Home', sell: 'Sell', receive: 'Receive', stockTake: 'Stock take', products: 'Products', reports: 'Reports', settings: 'Settings' },
  common: {
    cancel: 'Cancel', save: 'Save', done: 'Done', close: 'Close', delete: 'Delete', edit: 'Edit', add: 'Add',
    search: 'Search', startCamera: 'Start camera', stopCamera: 'Stop camera', scanPhoto: 'Scan from photo',
    typeCode: 'Type code', searchByName: 'Search by name', torch: 'Torch', custom: 'Custom', apply: 'Apply',
    back: 'Back', loading: 'Loading…', noResults: 'No results', confirm: 'Confirm',
  },
  home: {
    title: 'Home', todaySales: "Today's sales", salesCount: (n: number) => `${n} sale${n === 1 ? '' : 's'}`,
    lowStock: 'Low stock', lowStockCount: (n: number) => `${n} item${n === 1 ? '' : 's'} low`,
    sell: 'Sell', receive: 'Receive stock', stockTake: 'Stock take',
  },
  sell: {
    title: 'Sell', cart: 'Cart', empty: 'Cart is empty — scan an item or pick a favourite.',
    favourites: 'Favourites', unknownBarcode: 'Unknown barcode', addProductSheetTitle: 'Add product',
    productName: 'Product name', price: 'Price', addAndSell: 'Add and put in cart',
    checkout: 'Checkout', total: 'Total', subtotal: 'Subtotal', vat: 'VAT (15%)',
    paymentMethod: 'Payment method', cash: 'Cash', card: 'Card', other: 'Other',
    tendered: 'Cash tendered', change: 'Change due', short: 'Short by', exact: 'Exact',
    completeSale: 'Complete sale', recentSales: 'Recent sales', voidSale: 'Void sale',
    voided: 'Voided', lowStockWarning: (n: number) => `Only ${n} left in stock — selling anyway.`,
    outOfStockWarning: 'This will take stock below zero — selling anyway.',
  },
  receive: {
    title: 'Receive stock', building: 'This delivery', quantity: 'Quantity', costPerUnit: 'Cost per unit',
    costPerPack: 'Cost per pack', thisIsABox: 'This is a box / pack', packOf: 'Pack of', units: 'units',
    addToDelivery: 'Add to delivery', saveDelivery: 'Save delivery', supplier: 'Supplier (optional)',
    newProduct: 'New product — add it first', deliveryTotal: 'Delivery total', savedDelivery: 'Delivery saved.',
  },
  stockTake: {
    title: 'Stock take', start: 'Start stock take', inProgress: 'In progress', expected: 'Expected',
    counted: 'Counted', finish: 'Finish count', variance: 'Variance report', uncounted: 'Not counted',
    uncountedChoice: 'Treat items you never scanned as:', treatAsZero: 'Zero (not on shelf)',
    leaveUnchanged: 'Leave at expected (skip them)', shrinkage: 'Shrinkage value', diff: 'Difference',
    applyAdjustments: 'Apply adjustments', applied: 'Stock take applied.', enterCount: 'Enter count',
  },
  products: {
    title: 'Products', addProduct: 'Add product', editProduct: 'Edit product', stock: 'Stock',
    lowBadge: 'Low', reorderLevel: 'Reorder level', category: 'Category', barcode: 'Barcode',
    sellPrice: 'Sell price', lastCost: 'Last cost', history: 'Movement history', noHistory: 'No movements yet.',
    labels: 'Print labels', generateBarcode: 'Generate an in-store barcode', favourite: 'Show in Sell favourites',
  },
  labels: {
    title: 'Labels', printPage: 'Print', selectItems: 'Select items to print', noneSelected: 'Select at least one item.',
  },
  reports: {
    title: 'Reports', salesByDay: 'Sales by day', topSellers: 'Top sellers', grossProfit: 'Gross profit (estimate)',
    stockValue: 'Stock value at cost', qty: 'Qty', revenue: 'Revenue',
  },
  settings: {
    title: 'Settings', shopName: 'Shop name', vat: 'VAT', vatHint: 'Adds 15% at checkout when on.',
    backup: 'Backup', exportBackup: 'Export backup (JSON)', importBackup: 'Import backup (JSON)',
    exportCsv: 'Export CSV', exportProductsCsv: 'Products CSV', exportMovementsCsv: 'Movements CSV',
    demo: 'Demo data', loadDemoData: 'Load demo data', demoLoaded: 'Demo data loaded.',
    danger: 'Danger zone', resetEverything: 'Reset everything', resetConfirmLabel: 'Type RESET to confirm',
    resetDone: 'Everything was reset.',
  },
};
