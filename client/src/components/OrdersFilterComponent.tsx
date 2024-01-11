import { useState } from "react";
import { FilterButton } from "../elements/FilterButton";
import { SecondaryPopup } from "../elements/SecondaryPopup";
import { getOrderName, orders } from "@bibliothecadao/eternum";
import Button from "../elements/Button";
import { OrderIcon } from "../elements/OrderIcon";
import clsx from "clsx";

type OrdersFilterProps = {
  selectedOrders: number[];
  setSelectedOrders: (orders: number[]) => void;
};

export const OrdersFilter = ({ selectedOrders, setSelectedOrders }: OrdersFilterProps) => {
  const [popupOpened, setPopupOpened] = useState<boolean>(false);

  const selectOrder = (order: number) => {
    if (selectedOrders.includes(order)) {
      setSelectedOrders(selectedOrders.filter((o) => o !== order));
    } else {
      setSelectedOrders([...selectedOrders, order]);
    }
  };

  return (
    <>
      <FilterButton active={popupOpened} onClick={() => setPopupOpened(!popupOpened)}>
        Orders
      </FilterButton>
      {popupOpened && (
        <SecondaryPopup>
          <SecondaryPopup.Head onClose={() => setPopupOpened(false)}>
            <div className="flex items-center space-x-1">
              <div className="mr-0.5">Orders:</div>
              {selectedOrders.map((order, index) => (
                <OrderIcon key={index} order={getOrderName(order)} size="xs" />
              ))}
              {selectedOrders.length > 0 && (
                <Button onClick={() => setSelectedOrders([])} variant="outline" size="xs">
                  Clear all
                </Button>
              )}
            </div>
          </SecondaryPopup.Head>
          <SecondaryPopup.Body width={"284px"}>
            <div className="grid grid-cols-4 gap-2 p-2">
              {orders
                // remove order of gods
                .filter((order) => order.orderId !== 17)
                .map((order, index) => (
                  <div
                    key={index}
                    className={clsx(
                      "flex cursor-pointer flex-col items-center py-2 hover:bg-dark rounded-xl text-gold text-xxs",
                      selectedOrders.includes(order.orderId) && `bg-order-${order.orderName.toLowerCase()} !text-white`,
                    )}
                    onClick={() => selectOrder(order.orderId)}
                  >
                    <OrderIcon
                      color={selectedOrders.includes(order.orderId) ? "white" : undefined}
                      order={order.orderName}
                      size="xs"
                      className="mb-2"
                    />
                    <div>{order.orderName}</div>
                  </div>
                ))}
            </div>
            <div className="flex justify-start mx-2 mb-2">
              <Button onClick={() => setPopupOpened(false)} variant="primary">
                Close
              </Button>
            </div>
          </SecondaryPopup.Body>
        </SecondaryPopup>
      )}
    </>
  );
};
