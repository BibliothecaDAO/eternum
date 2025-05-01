export const useMarketplace = () => {
  const listItem = () => console.log("listItem");

  const acceptOrder = () => console.log("acceptOrder");

  const cancelOrder = () => console.log("cancelOrder");

  const editOrder = () => console.log("editOrder");

  return {
    listItem,
    acceptOrder,
    cancelOrder,
    editOrder,
  };
};
