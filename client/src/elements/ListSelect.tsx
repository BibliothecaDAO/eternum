import { Fragment, ReactNode, useMemo } from "react";
import { Listbox, Transition } from "@headlessui/react";
import { ReactComponent as CaretDown } from "../assets/icons/common/caret-down-fill.svg";
import { ReactComponent as Checkmark } from "../assets/icons/common/checkmark.svg";
import clsx from "clsx";

export interface ListSelectOption {
  id: number;
  label: ReactNode;
}

interface ListSelectProps {
  options: ListSelectOption[];
  value: number;
  onChange: (value: number) => void;
}

function ListSelect(props: ListSelectProps) {
  const selectedOption = useMemo(
    () => props.options.find((option) => option.id === props.value) || props.options[0],
    [props.value],
  );
  return (
    <div className="w-48">
      <Listbox value={props.value} onChange={props.onChange}>
        {({ open }) => (
          <div className="relative mt-1">
            <Listbox.Button className="relative w-full cursor-pointer rounded-md text-xs border border-gold !text-gold bg-brown hover:bg-gold/10 p-2">
              <span className="block truncate flex items-center">{selectedOption.label}</span>
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
              <div className="absolute mt-1 w-full text-xs">
                <svg
                  width="25"
                  height="18"
                  className="absolute left-1/2 top-0 -translate-x-1/2"
                  viewBox="0 0 25 18"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M10.1931 1.56404C11.3927 0.12124 13.6073 0.121242 14.8069 1.56404L23.9998 12.6214C25.6248 14.576 24.2348 17.5393 21.6929 17.5393H3.30708C0.76518 17.5393 -0.624826 14.576 1.00021 12.6214L10.1931 1.56404Z"
                    fill="#54433A"
                  />
                </svg>

                <Listbox.Options className=" mt-3 max-h-60 w-full overflow-auto rounded-md bg-dark-brown py-1">
                  {props.options.map((option) => (
                    <Listbox.Option
                      key={option.id}
                      className={({ active }) =>
                        `relative cursor-pointer select-none py-2 flex items-center pl-8 text-gold ${
                          active ? "bg-gold/50 text-white/90" : ""
                        }`
                      }
                      value={option.id}
                    >
                      {({ selected }) => (
                        <>
                          <span
                            className={`flex items-center block truncate ${selected ? "font-bold" : "font-normal"}`}
                          >
                            {option.label}
                          </span>
                          {selected ? (
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3">
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
