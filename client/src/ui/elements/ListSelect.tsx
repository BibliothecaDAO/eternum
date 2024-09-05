import { ReactComponent as CaretDown } from "@/assets/icons/common/caret-down-fill.svg";
import { ReactComponent as Checkmark } from "@/assets/icons/common/checkmark.svg";
import { Listbox, Transition } from "@headlessui/react";
import clsx from "clsx";
import { Fragment, ReactNode, useMemo } from "react";

interface ListSelectOption {
  id: any;
  label: ReactNode;
}

type ListSelectProps = {
  title?: string;
  options: ListSelectOption[];
  value: any;
  onChange: (value: any) => void;
  className?: string;
  style?: "default" | "black";
};

function ListSelect(props: ListSelectProps) {
  const selectedOption = useMemo(
    () =>
      props.options.find((option) => option.id === props.value) ||
      props.options[0] || { id: "", label: "Select a wallet..." },
    [props.value],
  );
  return (
    <div className={clsx("w-full", props.className, "z-50")}>
      <Listbox value={props.value} onChange={props.onChange}>
        {({ open }) => (
          <div className="relative  ">
            <Listbox.Button
              className={clsx(
                "flex items-center relative  cursor-pointer text-xs py-1 min-h-[32px] z-0 w-full bg-gold/10  hover:bg-gold/20 px-2",
              )}
            >
              {props.title && <span className="truncate flex items-center !text-gold mr-2">{props.title}</span>}
              <span className="truncate flex items-center">{selectedOption.label}</span>
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                <div className="flex flex-col items-center justify-center ml-1">
                  <CaretDown
                    className={clsx("stroke-gold fill-gold transition-transform duration-100", open && "rotate-180")}
                  />
                </div>
              </span>
            </Listbox.Button>
            <Transition
              as={Fragment}
              show={open}
              appear
              enter="transition ease-out duration-100"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="transition ease-in duration-100"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed z-50 mt-1 w-min text-xs">
                {/* <svg
                  width="25"
                  height="18"
                  className="absolute right-1/2 translate-x-1/2 top-0 z-40"
                  viewBox="0 0 25 18"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M10.1931 1.56404C11.3927 0.12124 13.6073 0.121242 14.8069 1.56404L23.9998 12.6214C25.6248 14.576 24.2348 17.5393 21.6929 17.5393H3.30708C0.76518 17.5393 -0.624826 14.576 1.00021 12.6214L10.1931 1.56404Z"
                    fill={props.style === "black" ? "#000" : "#54433A"}
                  />
                </svg> */}

                <Listbox.Options
                  className={clsx(
                    "z-50 mt-3 w-full rounded-md py-1 h-72 overflow-scroll z-100 border border-gold/10",
                    props.style === "black" ? "bg-black" : " bg-black/90",
                  )}
                >
                  {props.options.map((option) => (
                    <Listbox.Option
                      key={option.id}
                      className={({ active }) =>
                        `overflow-visible relative cursor-pointer z-50 select-none py-2 flex items-center pl-8 text-gold ${
                          active ? "bg-gold/10 text-white/90" : ""
                        }`
                      }
                      value={option.id}
                    >
                      {({ selected }) => (
                        <>
                          <span
                            className={`z-50 flex items-center  truncate ${
                              selected ? "font-bold text-white" : "font-normal"
                            }`}
                          >
                            {option.label}
                          </span>
                          {selected ? (
                            <span className="z-50 absolute inset-y-0 left-0 flex items-center pl-3">
                              <Checkmark className="h-3 w-3 fill-gold " aria-hidden="true" />
                            </span>
                          ) : null}
                        </>
                      )}
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </div>
            </Transition>
          </div>
        )}
      </Listbox>
    </div>
  );
}

export default ListSelect;
